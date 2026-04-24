import { createHash } from "crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { DATA_DIR } from "../../db.js";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";

export const COVER_DIR = join(DATA_DIR, "covers");
export const COVER_PUBLIC_PATH = "/api/covers";

const EXTS: ReadonlyArray<"jpg" | "png" | "webp"> = ["jpg", "png", "webp"];

// Hosts we are willing to fetch cover images from. Keeps the downloader from
// being a general-purpose SSRF gadget if a plugin ever returns a bad URL.
const ALLOWED_HOSTS = new Set([
  "books.google.com",
  "books.googleusercontent.com",
  "covers.openlibrary.org",
  "www.obalkyknih.cz",
  "obalkyknih.cz",
  "www.cbdb.cz",
  "cbdb.cz",
  "www.databazeknih.cz",
  "databazeknih.cz",
  "www.legie.info",
  "legie.info",
]);

let dirReady = false;
function ensureCoverDir(): void {
  if (dirReady) return;
  mkdirSync(COVER_DIR, { recursive: true });
  dirReady = true;
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return trimmed;
  }
}

function hostAllowed(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return ALLOWED_HOSTS.has(h);
  } catch {
    return false;
  }
}

function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

function extFromContentType(ct: string | null): "jpg" | "png" | "webp" | null {
  if (!ct) return null;
  const c = ct.toLowerCase();
  if (c.includes("jpeg") || c.includes("jpg")) return "jpg";
  if (c.includes("png")) return "png";
  if (c.includes("webp")) return "webp";
  return null;
}

function findExisting(hash: string): string | null {
  for (const ext of EXTS) {
    const name = `${hash}.${ext}`;
    if (existsSync(join(COVER_DIR, name))) return name;
  }
  return null;
}

const inflight = new Map<string, Promise<string | null>>();

/** Download + validate + store an upstream cover. Returns same-origin URL or null. */
export async function ensureCover(upstreamUrl: string): Promise<string | null> {
  if (!upstreamUrl) return null;
  const normalized = normalizeUrl(upstreamUrl);
  if (!hostAllowed(normalized)) {
    logger.debug({ url: normalized }, "coverCache: host not allowed");
    return null;
  }

  ensureCoverDir();
  const hash = sha1(normalized);

  const running = inflight.get(hash);
  if (running) return running;

  const existing = findExisting(hash);
  if (existing) return `${COVER_PUBLIC_PATH}/${existing}`;

  const p = (async () => {
    try {
      const r = await rateLimitedFetch(normalized, {
        signal: AbortSignal.timeout(10000),
      });
      if (!r.ok) return null;
      const buf = Buffer.from(await r.arrayBuffer());
      let ext = extFromContentType(r.headers.get("content-type"));

      const meta = await sharp(buf).metadata();
      if (!meta.width || !meta.height || meta.width < 20 || meta.height < 20) {
        return null;
      }
      if (!ext) {
        if (meta.format === "jpeg") ext = "jpg";
        else if (meta.format === "png") ext = "png";
        else if (meta.format === "webp") ext = "webp";
        else return null;
      }

      const finalName = `${hash}.${ext}`;
      const finalPath = join(COVER_DIR, finalName);
      const tmpPath = join(COVER_DIR, `.${finalName}.tmp`);
      writeFileSync(tmpPath, buf);
      renameSync(tmpPath, finalPath);
      return `${COVER_PUBLIC_PATH}/${finalName}`;
    } catch (err) {
      logger.debug(
        { url: normalized, err: (err as Error).message },
        "coverCache: fetch/validate failed",
      );
      return null;
    } finally {
      inflight.delete(hash);
    }
  })();

  inflight.set(hash, p);
  return p;
}

/** Rewrite a single URL through the cache. Same-origin URLs pass through; failures return null. */
export async function cacheCoverUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith(COVER_PUBLIC_PATH)) return url;
  return ensureCover(url);
}

// TODO: evict old covers. Unbounded growth — ~10 KB × N books. Fine for now;
// add an LRU/age trim as a follow-up when needed.
