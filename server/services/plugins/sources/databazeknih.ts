import { rateLimitedFetch, CZ_BROWSER_HEADERS } from "../../../http.js";
import type { BookSearchResult, BookSourcePlugin } from "../types.js";

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

// Site ratings are 0–5; normalize to 0–100 to match Google Books / cbdb.
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

  // JSON-LD description is truncated. Prefer DOM version when present.
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

  // pageCount loaded asynchronously via "více info…" — skip here.
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

export interface DbkEdition {
  isbn: string | null;
  title: string;
  year: string;
  publisher: string;
  coverUrl: string;
  language: string;
}

const DBK_BASE = "https://www.databazeknih.cz";

export function parseDbkEditionLanguageSlugs(html: string): string[] {
  const langs = new Set<string>();
  const re = /\/dalsi-vydani\/[a-z0-9-]+\?lang=([a-z]{2})/gi;
  let m;
  while ((m = re.exec(html)) !== null) langs.add(m[1].toLowerCase());
  return [...langs];
}

export function parseDbkEditions(html: string, language = ""): DbkEdition[] {
  const startMarker = html.indexOf("<a name='editions'>");
  const slice = startMarker >= 0 ? html.slice(startMarker) : html;

  const editions: DbkEdition[] = [];
  const seen = new Set<string>();

  const itemRe =
    /<a href="(\/dalsi-vydani\/[a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<hr class='oddown'|<div id="ads-offer-box)/g;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(slice)) !== null) {
    const link = m[1];
    const inner = m[2];
    const tail = m[3];

    if (!inner.includes("<picture") && !inner.includes("<img ")) continue;

    const imgMatch = inner.match(/<img[^>]*src="([^"]+)"[^>]*alt="Obálka knihy([^"]*)"/);
    if (!imgMatch) continue;

    const coverUrl = imgMatch[1];
    const altText = imgMatch[2].trim();
    const yearMatch = altText.match(/\((\d{4})\)/);
    const title = altText.replace(/\s*\(\d{4}\)\s*$/, "").trim();
    const year = yearMatch?.[1] ?? "";

    const publisherMatch = tail.match(/<a href="\/nakladatelstvi\/[^"]+"[^>]*>([^<]+)<\/a>/);
    const publisher = decodeHtmlEntities(publisherMatch?.[1]?.trim() ?? "");

    const isbnMatch = tail.match(/ISBN:\s*<\/[^>]+>?\s*([0-9-Xx]{10,20})/);
    const isbnRaw =
      isbnMatch?.[1] ?? tail.match(/ISBN:[\s\S]{0,80}?([0-9][0-9-]{8,18}[0-9Xx])/)?.[1];
    const isbn = isbnRaw ? isbnRaw.replace(/-/g, "") : null;

    const key = `${link}|${isbn ?? coverUrl}`;
    if (seen.has(key)) continue;
    seen.add(key);

    editions.push({ isbn, title, year, publisher, coverUrl, language });
  }
  return editions;
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

async function fetchDbk(
  param: "isbn" | "q",
  value: string,
  signal: AbortSignal,
): Promise<BookSearchResult | null> {
  const r1 = await rateLimitedFetch(
    `https://www.databazeknih.cz/search?q=${encodeURIComponent(value)}`,
    { headers: CZ_BROWSER_HEADERS, redirect: "follow", signal },
  );
  if (!r1.ok) return null;
  const html1 = await r1.text();
  const finalUrl = r1.url;

  if (finalUrl.includes("/prehled-knihy/")) {
    const book = parseDatabazeknihBookPage(html1);
    if (book) return toResult(book, param, value);
  }

  const links = parseDatabazeknihSearchLinks(html1);
  if (!links.length) return null;

  const r2 = await rateLimitedFetch(`https://www.databazeknih.cz${links[0]}`, {
    headers: CZ_BROWSER_HEADERS,
    signal,
  });
  if (!r2.ok) return null;
  const book = parseDatabazeknihBookPage(await r2.text());
  return book ? toResult(book, param, value) : null;
}

async function findDbkBookSlug(query: string, signal: AbortSignal): Promise<string | null> {
  if (!query) return null;
  const r = await rateLimitedFetch(`${DBK_BASE}/search?q=${encodeURIComponent(query)}`, {
    headers: CZ_BROWSER_HEADERS,
    redirect: "follow",
    signal,
  });
  if (!r.ok) return null;
  const finalUrl = r.url;
  const directMatch = finalUrl.match(/\/prehled-knihy\/([a-z0-9-]+)/i);
  if (directMatch) return directMatch[1];
  const html = await r.text();
  const links = parseDatabazeknihSearchLinks(html);
  if (!links.length) return null;
  return links[0].replace("/prehled-knihy/", "");
}

interface DbkBookHeader {
  title: string;
  authors: string[];
  genres: string[];
  description: string;
  series: string;
  seriesNumber: string;
  averageRating: number | null;
  ratingsCount: number | null;
}

async function fetchDbkBookHeader(
  slug: string,
  signal: AbortSignal,
): Promise<DbkBookHeader | null> {
  const r = await rateLimitedFetch(`${DBK_BASE}/prehled-knihy/${slug}`, {
    headers: CZ_BROWSER_HEADERS,
    signal,
  });
  if (!r.ok) return null;
  const b = parseDatabazeknihBookPage(await r.text());
  if (!b) return null;
  return {
    title: b.title,
    authors: b.authors,
    genres: b.genres,
    description: b.description,
    series: b.series,
    seriesNumber: b.seriesNumber,
    averageRating: b.averageRating,
    ratingsCount: b.ratingsCount,
  };
}

async function fetchDbkEditionsAll(slug: string, signal: AbortSignal): Promise<DbkEdition[]> {
  const r = await rateLimitedFetch(`${DBK_BASE}/dalsi-vydani/${slug}`, {
    headers: CZ_BROWSER_HEADERS,
    signal,
  });
  if (!r.ok) return [];
  const html = await r.text();
  const langs = parseDbkEditionLanguageSlugs(html);
  const baseLang = (
    html.match(/class="tab now"[\s\S]{0,200}?\?lang=([a-z]{2})/i)?.[1] ?? ""
  ).toLowerCase();
  const editions: DbkEdition[] = parseDbkEditions(html, baseLang);

  const otherLangs = langs.filter((l) => l !== baseLang);
  if (otherLangs.length) {
    const more = await Promise.all(
      otherLangs.map(async (lang) => {
        const lr = await rateLimitedFetch(`${DBK_BASE}/dalsi-vydani/${slug}?lang=${lang}`, {
          headers: CZ_BROWSER_HEADERS,
          signal,
        });
        if (!lr.ok) return [];
        return parseDbkEditions(await lr.text(), lang);
      }),
    );
    for (const arr of more) editions.push(...arr);
  }
  return editions;
}

function toResult(b: DatabazeknihBook, param: "isbn" | "q", value: string): BookSearchResult {
  return {
    isbn: b.isbn ?? (param === "isbn" ? value : null),
    title: b.title,
    authors: b.authors,
    genres: b.genres,
    description: b.description,
    publisher: b.publisher,
    pageCount: b.pageCount,
    coverUrl: b.coverUrl,
    averageRating: b.averageRating,
    ratingsCount: b.ratingsCount,
    series: b.series,
    seriesNumber: b.seriesNumber,
  };
}

export const databazeknihPlugin: BookSourcePlugin = {
  id: "databazeknih",
  name: "databazeknih.cz",
  description: "Czech book database.",
  timeoutMs: 10000,

  searchByISBN: (isbn, signal) => fetchDbk("isbn", isbn, signal),

  async searchByTitle(title, signal) {
    const b = await fetchDbk("q", title, signal);
    return b ? [b] : [];
  },

  async findCovers({ isbn, title }, signal) {
    const key = isbn || title;
    if (!key) return [];
    const b = await fetchDbk(isbn ? "isbn" : "q", key, signal);
    return b?.coverUrl ? [b.coverUrl] : [];
  },

  async searchEditions(query, signal) {
    if (!query) return [];
    const slug = await findDbkBookSlug(query, signal);
    if (!slug) return [];
    const [header, editions] = await Promise.all([
      fetchDbkBookHeader(slug, signal),
      fetchDbkEditionsAll(slug, signal),
    ]);
    if (!editions.length) {
      if (!header) return [];
      return [
        {
          isbn: null,
          title: header.title,
          authors: header.authors,
          genres: header.genres,
          description: header.description,
          publisher: "",
          pageCount: null,
          coverUrl: "",
          averageRating: header.averageRating,
          ratingsCount: header.ratingsCount,
          series: header.series,
          seriesNumber: header.seriesNumber,
        },
      ];
    }
    return editions.map((e) => ({
      isbn: e.isbn,
      title: e.title || header?.title || "",
      authors: header?.authors ?? [],
      genres: header?.genres ?? [],
      description: header?.description ?? "",
      publisher: e.publisher,
      pageCount: null,
      coverUrl: e.coverUrl,
      averageRating: header?.averageRating ?? null,
      ratingsCount: header?.ratingsCount ?? null,
      series: header?.series ?? "",
      seriesNumber: header?.seriesNumber ?? "",
      year: e.year,
      language: e.language,
    }));
  },
};
