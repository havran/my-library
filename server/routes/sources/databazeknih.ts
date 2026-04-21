import { Router } from "express";
import { rateLimitedFetch, CZ_BROWSER_HEADERS } from "../../http.js";
import { logger } from "../../logger.js";

export interface DatabazeknihBook {
  isbn: string | null;
  title: string;
  authors: string[];
  genres: string[];
  description: string;
  publisher: string;
  pageCount: number | null;
  coverUrl: string;
  averageRating: number | null;
  ratingsCount: number | null;
  series: string;
  seriesNumber: string;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

// Site ratings are on a 0–5 scale; normalize to 0–100 to match what the rest
// of the app assumes (Google Books / cbdb return percents).
function toPercentRating(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 20);
}

export function parseDatabazeknihBookPage(html: string): DatabazeknihBook | null {
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ldMatch) return null;
  let ld: {
    name?: string;
    isbn?: string;
    image?: string;
    description?: string;
    author?: Array<{ name?: string }>;
    publisher?: Array<{ name?: string }>;
    aggregateRating?: { ratingValue?: string | number; ratingCount?: string | number };
  };
  try {
    ld = JSON.parse(ldMatch[1]);
  } catch {
    return null;
  }
  if (!ld?.name) return null;

  const title = ld.name;
  const coverUrl = ld.image ?? "";
  const authors = (ld.author ?? []).map((a) => a.name ?? "").filter(Boolean);
  const publisher = (ld.publisher ?? [])
    .map((p) => p.name ?? "")
    .filter(Boolean)
    .join(", ");
  const isbn = ld.isbn ? ld.isbn.replace(/-/g, "") : null;
  const averageRating = toPercentRating(ld.aggregateRating?.ratingValue);
  const ratingsCount = ld.aggregateRating?.ratingCount
    ? parseInt(String(ld.aggregateRating.ratingCount))
    : null;

  const genres: string[] = [];
  const genreRe = /<a[^>]*class="genre"[^>]*>([^<]+)<\/a>/g;
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = gm[1].trim();
    if (g) genres.push(g);
  }

  // Description sits in <p class='new2 odtop'>preview<span class='end_text …'>rest</span>"… celý text"</p>.
  // The JSON-LD description is truncated, so prefer the DOM version when present.
  let description = ld.description ?? "";
  const descMatch = html.match(
    /<p class=['"]new2[^'"]*['"][^>]*>([\s\S]*?)<a[^>]*class=['"]show_hide_more/,
  );
  if (descMatch) {
    const preview = descMatch[1].replace(/<span class=['"]end_text[^>]*>([\s\S]*?)<\/span>/, "$1");
    const cleaned = decodeHtmlEntities(stripTags(preview)).trim();
    if (cleaned.length > description.length) description = cleaned;
  }

  let series = "";
  let seriesNumber = "";
  const seriesMatch = html.match(
    /<a[^>]*href=['"]\/serie\/[^'"]*['"][^>]*title=['"]([^'"]+)['"][^>]*>[\s\S]*?<\/a>\s*s[eé]rie/i,
  );
  if (seriesMatch) series = decodeHtmlEntities(seriesMatch[1]).trim();
  const numMatch = html.match(/<span[^>]*>\s*(\d+)\.\s*díl\s*<\/span>/i);
  if (numMatch) seriesNumber = numMatch[1];

  // pageCount is loaded asynchronously via "více info..." — skip it here.
  const pageCount = null;

  return {
    isbn,
    title,
    authors,
    genres,
    description,
    publisher,
    pageCount,
    coverUrl,
    averageRating,
    ratingsCount,
    series,
    seriesNumber,
  };
}

export function parseDatabazeknihSearchLinks(html: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  const re = /href=['"](\/prehled-knihy\/[a-z0-9-]+)['"]/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      links.push(m[1]);
    }
  }
  return links;
}

export const databazeknihRouter: Router = Router();

databazeknihRouter.get("/", async (req, res) => {
  const isbn = String(req.query.isbn ?? "").trim();
  const q = String(req.query.q ?? "").trim();
  const query = isbn || q;
  if (!query) {
    res.status(400).json({ error: "isbn or q required" });
    return;
  }

  try {
    const r1 = await rateLimitedFetch(
      `https://www.databazeknih.cz/search?q=${encodeURIComponent(query)}`,
      {
        headers: CZ_BROWSER_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(10000),
      },
    );
    const html1 = await r1.text();
    const finalUrl = r1.url;

    if (finalUrl.includes("/prehled-knihy/")) {
      const book = parseDatabazeknihBookPage(html1);
      if (book) {
        res.json(book);
        return;
      }
    }

    const links = parseDatabazeknihSearchLinks(html1);
    if (links.length === 0) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const r2 = await rateLimitedFetch(`https://www.databazeknih.cz${links[0]}`, {
      headers: CZ_BROWSER_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    const html2 = await r2.text();
    const book = parseDatabazeknihBookPage(html2);
    if (book) {
      res.json(book);
      return;
    }

    res.status(404).json({ error: "Not found" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "databazeknih error";
    logger.warn({ source: "databazeknih", query, err: msg }, "databazeknih proxy error");
    res.status(504).json({ error: "databazeknih timeout or error" });
  }
});
