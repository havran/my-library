import https from "https";
import { readFileSync } from "fs";
import express from "express";
import cors from "cors";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import {
  getAllBooks, getBook, addBook, updateBook, deleteBook,
  searchBooks, exportAllBooks, importBooks, clearAllBooks,
} from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3001;
const CERT_DIR = resolve(__dirname, "..");

app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/api/books/search", (req, res) => {
  const q = String(req.query.q ?? "");
  res.json(searchBooks(q));
});

app.get("/api/books", (_req, res) => {
  res.json(getAllBooks());
});

app.get("/api/books/:id", (req, res) => {
  const book = getBook(req.params.id);
  if (!book) { res.status(404).json({ error: "Not found" }); return; }
  res.json(book);
});

app.post("/api/books", (req, res) => {
  addBook(req.body);
  res.json({ ok: true });
});

app.put("/api/books/:id", (req, res) => {
  updateBook(req.params.id, req.body);
  res.json({ ok: true });
});

app.delete("/api/books/:id", (req, res) => {
  deleteBook(req.params.id);
  res.json({ ok: true });
});

app.delete("/api/books", (_req, res) => {
  clearAllBooks();
  res.json({ ok: true });
});

app.get("/api/export", (_req, res) => {
  res.json(exportAllBooks());
});

app.post("/api/import", (req, res) => {
  try {
    const count = importBooks(req.body);
    res.json({ count });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── ISBN OCR endpoint ──────────────────────────────────────────────────────────

let _ocrWorkerPromise: Promise<any> | null = null;
function getOCRWorker() {
  if (!_ocrWorkerPromise) {
    _ocrWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng");
      await w.setParameters({
        tessedit_char_whitelist: "0123456789",
        tessedit_pageseg_mode: "11" as any, // sparse text — best for scattered numbers
      });
      return w;
    })();
  }
  return _ocrWorkerPromise;
}

async function preprocessISBN(buffer: Buffer, invert: boolean): Promise<Buffer> {
  let pipeline = sharp(buffer)
    .greyscale()
    .normalise()        // auto-level histogram — handles any contrast
    .sharpen();
  if (invert) pipeline = pipeline.negate();
  return pipeline
    .threshold(140)     // binarise → pure black/white, best for Tesseract
    .png()
    .toBuffer();
}

app.post("/api/isbn-ocr", async (req, res) => {
  const { image } = req.body as { image?: string };
  if (!image) { res.status(400).json({ error: "image required" }); return; }

  try {
    const inputBuffer = Buffer.from(image, "base64");
    const worker = await getOCRWorker();

    // Try normal + inverted in parallel — handles both dark-on-light and light-on-dark
    const [normal, inverted] = await Promise.all([
      preprocessISBN(inputBuffer, false),
      preprocessISBN(inputBuffer, true),
    ]);

    const [r1, r2] = await Promise.all([
      worker.recognize(normal),
      worker.recognize(inverted),
    ]);

    const combined = r1.data.text + " " + r2.data.text;
    const digits = combined.replace(/[^0-9]/g, "");

    const full = digits.match(/97[89]\d{10}/)?.[0] ?? null;
    const partial = !full ? (digits.match(/97[89]\d{0,9}/)?.[0] ?? null) : null;

    res.json({ isbn: full, partial: partial && partial.length >= 6 ? partial : null });
  } catch (e: any) {
    console.warn("isbn-ocr error:", e?.message);
    res.status(500).json({ isbn: null, partial: null });
  }
});

// ── Per-host rate limiter (1 s between requests to the same hostname) ─────────

const _lastRequestTime = new Map<string, number>();

async function rateLimitedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const host = new URL(url).hostname;
  const last = _lastRequestTime.get(host) ?? 0;
  const wait = Math.max(0, 1000 - (Date.now() - last));
  if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
  _lastRequestTime.set(host, Date.now());
  return fetch(url, opts);
}

// ── cbdb.cz proxy ─────────────────────────────────────────────────────────────

const CBDB_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,sk;q=0.8",
};

function parseCbdbBookPage(html: string): Record<string, any> | null {
  // Extract JSON-LD block
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ldMatch) return null;
  let ld: any;
  try { ld = JSON.parse(ldMatch[1]); } catch { return null; }
  if (!ld?.name) return null;

  const title = ld.name as string;
  const coverUrl = (ld.image || ld.thumbnailUrl || "") as string;
  const description = (ld.description || "") as string;
  const authors = ((ld.author || []) as any[]).map((a: any) => a.name || "").filter(Boolean);
  const averageRating = ld.aggregateRating?.ratingValue ? parseFloat(ld.aggregateRating.ratingValue) : null;
  const ratingsCount = ld.aggregateRating?.ratingCount ? parseInt(ld.aggregateRating.ratingCount) : null;

  // Genres from genre_label links
  const genres: string[] = [];
  const genreRe = /class="genre_label"[^>]*>([^<]+)<\/a>/g;
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = gm[1].trim();
    if (g) genres.push(g);
  }

  // Publisher, pageCount, ISBN from gray_box
  const publisherMatch = html.match(/<b>Nakladatelství \(rok\):<\/b>[^<]*<a[^>]*>([^<]+)<\/a>/);
  const publisher = publisherMatch ? publisherMatch[1].trim() : "";

  const pageMatch = html.match(/<b>Stran:<\/b>\s*(\d+)/);
  const pageCount = pageMatch ? parseInt(pageMatch[1]) : null;

  const isbnMatch = html.match(/<b>ISBN:<\/b>\s*(\d[\d\-X]+)/i);
  const isbn = isbnMatch ? isbnMatch[1].replace(/-/g, "") : null;

  return { isbn, title, authors, genres, description, publisher, pageCount, coverUrl, averageRating, ratingsCount };
}

function parseCbdbSearchLinks(html: string): string[] {
  const links: string[] = [];
  const re = /href="(kniha-\d+[^"]*)"[^>]*class="search_graphic_box_img"/g;
  let m;
  while ((m = re.exec(html)) !== null) links.push(m[1]);
  // Fallback: any book link in search result table
  if (links.length === 0) {
    const re2 = /href="(kniha-\d+[^"]*)"[^>]*class="search_text\d/g;
    while ((m = re2.exec(html)) !== null) {
      if (!links.includes(m[1])) links.push(m[1]);
    }
  }
  return links;
}

app.get("/api/cbdb", async (req, res) => {
  const isbn = String(req.query.isbn ?? "").trim();
  const q = String(req.query.q ?? "").trim();
  const query = isbn || q;
  if (!query) { res.status(400).json({ error: "isbn or q required" }); return; }

  try {
    const r1 = await rateLimitedFetch(`https://www.cbdb.cz/hledat?text=${encodeURIComponent(query)}`, {
      headers: CBDB_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
    });
    const html1 = await r1.text();
    const finalUrl = r1.url;

    // Direct book page (ISBN redirected)
    if (finalUrl.includes("/kniha-")) {
      const book = parseCbdbBookPage(html1);
      if (book) { res.json(book); return; }
    }

    // Search results list — follow first result
    const links = parseCbdbSearchLinks(html1);
    if (links.length === 0) { res.status(404).json({ error: "Not found" }); return; }

    const r2 = await rateLimitedFetch(`https://www.cbdb.cz/${links[0]}`, {
      headers: CBDB_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    const html2 = await r2.text();
    const book = parseCbdbBookPage(html2);
    if (book) { res.json(book); return; }

    res.status(404).json({ error: "Not found" });
  } catch (e: any) {
    console.warn("cbdb proxy error:", e?.message);
    res.status(504).json({ error: "cbdb timeout or error" });
  }
});

// ── legie.info proxy ──────────────────────────────────────────────────────────

const LEGIE_BASE = "https://www.legie.info";
const LEGIE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};

function parseLegieBookPage(html: string, baseUrl: string): Record<string, any> | null {
  const title = html.match(/id="nazev_knihy"[^>]*>([^<]+)<\/h2>/)?.[1]?.trim();
  if (!title) return null;

  const authors = [...html.matchAll(/<h3[^>]*><a href="autor\/[^"]*">([^<]+)<\/a><\/h3>/g)]
    .map(m => m[1].replace(/,\s*$/, "").trim())
    .filter(Boolean);

  const coverMatch = html.match(/id="hlavni_obalka"[^>]*src="([^"]+)"/);
  const coverUrl = coverMatch ? `${LEGIE_BASE}/${coverMatch[1]}` : "";

  const genres = [...html.matchAll(/href="tagy\/[^"]*">([^<]+)<\/a>/g)]
    .map(m => m[1].trim()).filter(Boolean);

  const ratingValue = html.match(/itemprop="ratingValue">(\d+)</)?.[1];
  const ratingCount = html.match(/itemprop="ratingCount">(\d+)</)?.[1];
  const averageRating = ratingValue ? parseFloat((parseInt(ratingValue) / 10).toFixed(1)) : null;
  const ratingsCount = ratingCount ? parseInt(ratingCount) : null;

  const seriesHrefMatch = html.match(/href="(serie\/[^"#]*)">([^<]+)<\/a>/);
  const serieSlug = seriesHrefMatch?.[1] ?? "";
  const series = seriesHrefMatch?.[2]?.trim() ?? "";
  const seriesNumberMatch = html.match(/díl v sérii:\s*(\d+)/);
  const seriesNumber = seriesNumberMatch?.[1] ?? "";

  const descMatch = html.match(/class="anotace"[^>]*>[\s\S]*?<p[^>]*><strong>Anotace:<\/strong><br[^>]*>\s*([\s\S]*?)<\/p>/);
  const description = descMatch
    ? descMatch[1].replace(/<[^>]+>/g, "").replace(/\n/g, " ").trim()
    : "";

  const legieUrl = baseUrl;

  return { title, authors, coverUrl, genres, averageRating, ratingsCount, series, serieSlug, seriesNumber, description, legieUrl };
}

function parseLegieSearchLinks(html: string): string[] {
  const links: string[] = [];
  // Capture slug only up to the first / (stops before subpages like /vydani, /zakladni-info)
  const re = /href="(kniha\/\d+[^\/#"]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].replace(/\/$/, "");
    if (!links.includes(href)) links.push(href);
  }
  return links;
}

interface LegieEdition {
  coverUrl: string;
  isbn: string | null;
  publisher: string;
  year: string;
  language: string;
}

function parseLegieEditions(html: string): LegieEdition[] {
  // Collect all cover image positions
  const coverRe = /src="(images\/kniha-small\/[^"]+\.jpg)"/g;
  const covers: Array<{ url: string; pos: number }> = [];
  let m: RegExpExecArray | null;
  const seenUrls = new Set<string>();
  while ((m = coverRe.exec(html)) !== null) {
    const url = `${LEGIE_BASE}/${m[1]}`;
    if (!seenUrls.has(url)) { seenUrls.add(url); covers.push({ url, pos: m.index }); }
  }

  // Collect all ISBN-13 positions
  const isbnRe = /97[89]\d{10}/g;
  const isbns: Array<{ isbn: string; pos: number }> = [];
  while ((m = isbnRe.exec(html)) !== null) isbns.push({ isbn: m[0], pos: m.index });

  return covers.map(({ url, pos }) => {
    // Look for the nearest ISBN within 3000 chars after (or 500 before) the cover image
    let bestIsbn: string | null = null;
    let bestDist = Infinity;
    for (const entry of isbns) {
      const dist = entry.pos >= pos ? entry.pos - pos : pos - entry.pos + 500; // penalise "before"
      if (dist < bestDist && dist < 3000) { bestDist = dist; bestIsbn = entry.isbn; }
    }

    // Extract a 2000-char window after the cover for additional metadata
    const window = html.slice(pos, pos + 2000);
    const publisherMatch = window.match(/Nakladatel(?:ství)?[^:]*:\s*<[^>]+>([^<]+)</) ??
                           window.match(/Nakladatel(?:ství)?[^:]*:\s*([^\n<]{2,60})/);
    const publisher = publisherMatch?.[1]?.trim() ?? "";
    const yearMatch = window.match(/Rok[^:]*:\s*(\d{4})/);
    const year = yearMatch?.[1] ?? "";
    const langMatch = window.match(/Jazyk[^:]*:\s*<[^>]+>([^<]+)</) ??
                      window.match(/Jazyk[^:]*:\s*([^\n<]{2,40})/);
    const language = langMatch?.[1]?.trim() ?? "";

    return { coverUrl: url, isbn: bestIsbn, publisher, year, language };
  });
}

app.get("/api/legie", async (req, res) => {
  const title = String(req.query.title ?? "").trim();
  const isbn = String(req.query.isbn ?? "").trim();
  const slug = String(req.query.slug ?? "").trim(); // direct slug, skips search
  if (!title && !isbn && !slug) { res.status(400).json({ error: "title, isbn, or slug required" }); return; }

  try {
    let bookSlug: string;

    if (slug) {
      bookSlug = slug.replace(/\/$/, "");
    } else {
      const query = title || isbn;
      const searchRes = await rateLimitedFetch(
        `${LEGIE_BASE}/index.php?search_text=${encodeURIComponent(query)}`,
        { headers: LEGIE_HEADERS, signal: AbortSignal.timeout(8000) }
      );
      const searchHtml = await searchRes.text();
      const finalUrl = searchRes.url;

      bookSlug = finalUrl.includes("/kniha/")
        ? finalUrl.replace(LEGIE_BASE + "/", "").replace(/\/.*$/, "")
        : parseLegieSearchLinks(searchHtml)[0];

      if (!bookSlug) { res.status(404).json({ error: "Not found" }); return; }
      bookSlug = bookSlug.replace(/\/$/, "");
    }

    // Fetch metadata + edition covers sequentially (1 s rate limit per request to legie.info)
    const infoRes = await rateLimitedFetch(
      `${LEGIE_BASE}/${bookSlug}/zakladni-info`,
      { headers: LEGIE_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    const infoHtml = await infoRes.text();

    const vydaniRes = await rateLimitedFetch(
      `${LEGIE_BASE}/${bookSlug}/vydani`,
      { headers: LEGIE_HEADERS, signal: AbortSignal.timeout(8000) }
    );
    const vydaniHtml = await vydaniRes.text();

    const book = parseLegieBookPage(infoHtml, `${LEGIE_BASE}/${bookSlug}`);
    if (!book) { res.status(404).json({ error: "Not found" }); return; }

    const editions = parseLegieEditions(vydaniHtml);
    const coverUrls = editions.map((e) => e.coverUrl);
    res.json({ ...book, editions, coverUrls });
  } catch (e: any) {
    console.warn("legie proxy error:", e?.message);
    res.status(504).json({ error: "legie timeout or error" });
  }
});

// ── legie.info series endpoint ────────────────────────────────────────────────

function parseLegieSeriesBooks(html: string): Array<{ slug: string; title: string; order: number }> {
  const books: Array<{ slug: string; title: string; order: number }> = [];
  const seen = new Set<string>();
  const re = /href="(kniha\/\d+[^"#]*)"[^>]*>([^<]+)<\/a>/g;
  let m;
  let order = 1;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].replace(/\/$/, "");
    const title = m[2].trim();
    if (title && !seen.has(slug)) {
      seen.add(slug);
      books.push({ slug, title, order: order++ });
    }
  }
  return books;
}

app.get("/api/legie/serie", async (req, res) => {
  const slug = String(req.query.slug ?? "").trim(); // e.g. "serie/156-duna"
  if (!slug) { res.status(400).json({ error: "slug required" }); return; }

  try {
    const serieRes = await rateLimitedFetch(
      `${LEGIE_BASE}/${slug}`,
      { headers: LEGIE_HEADERS, signal: AbortSignal.timeout(10000) }
    );
    const html = await serieRes.text();

    // Series title
    const titleMatch = html.match(/id="nazev_serie"[^>]*>([^<]+)<\/h2>/);
    const seriesTitle = titleMatch?.[1]?.trim() ?? "";

    const books = parseLegieSeriesBooks(html);
    res.json({ title: seriesTitle, books });
  } catch (e: any) {
    console.warn("legie serie proxy error:", e?.message);
    res.status(504).json({ error: "legie timeout or error" });
  }
});

const distDir = resolve(__dirname, "../dist");
app.use(express.static(distDir));
app.get(/(.*)/, (_req, res) => {
  res.sendFile(resolve(distDir, "index.html"));
});

try {
  const ssl = {
    key: readFileSync(resolve(CERT_DIR, "key.pem")),
    cert: readFileSync(resolve(CERT_DIR, "cert.pem")),
  };
  https.createServer(ssl, app).listen(PORT, () => {
    console.log(`Library API → https://localhost:${PORT}`);
  });
} catch {
  app.listen(PORT, () => {
    console.log(`Library API → http://localhost:${PORT} (no TLS cert found)`);
  });
}
