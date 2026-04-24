import { rateLimitedFetch, CZ_BROWSER_HEADERS } from "../../../http.js";
import type { BookSearchResult, BookSourcePlugin } from "../types.js";

export interface CbdbBook {
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
}

export function parseCbdbBookPage(html: string): CbdbBook | null {
  const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!ldMatch) return null;
  let ld: Record<string, unknown> & {
    name?: string;
    image?: string;
    thumbnailUrl?: string;
    description?: string;
    author?: Array<{ name?: string }>;
    aggregateRating?: { ratingValue?: string | number; ratingCount?: string | number };
  };
  try {
    ld = JSON.parse(ldMatch[1]);
  } catch {
    return null;
  }
  if (!ld?.name) return null;

  const title = ld.name;
  const coverUrl = (ld.image || ld.thumbnailUrl || "") as string;
  const description = ld.description ?? "";
  const authors = (ld.author ?? []).map((a) => a.name ?? "").filter(Boolean);
  const averageRating = ld.aggregateRating?.ratingValue
    ? parseFloat(String(ld.aggregateRating.ratingValue))
    : null;
  const ratingsCount = ld.aggregateRating?.ratingCount
    ? parseInt(String(ld.aggregateRating.ratingCount))
    : null;

  const genres: string[] = [];
  const genreRe = /class="genre_label"[^>]*>([^<]+)<\/a>/g;
  let gm;
  while ((gm = genreRe.exec(html)) !== null) {
    const g = gm[1].trim();
    if (g) genres.push(g);
  }

  const publisherMatch = html.match(/<b>Nakladatelství \(rok\):<\/b>[^<]*<a[^>]*>([^<]+)<\/a>/);
  const publisher = publisherMatch ? publisherMatch[1].trim() : "";

  const pageMatch = html.match(/<b>Stran:<\/b>\s*(\d+)/);
  const pageCount = pageMatch ? parseInt(pageMatch[1]) : null;

  const isbnMatch = html.match(/<b>ISBN:<\/b>\s*(\d[\d\-X]+)/i);
  const isbn = isbnMatch ? isbnMatch[1].replace(/-/g, "") : null;

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
  };
}

export function parseCbdbSearchLinks(html: string): string[] {
  const links: string[] = [];
  const re = /href="(kniha-\d+[^"]*)"[^>]*class="search_graphic_box_img"/g;
  let m;
  while ((m = re.exec(html)) !== null) links.push(m[1]);
  if (links.length === 0) {
    const re2 = /href="(kniha-\d+[^"]*)"[^>]*class="search_text\d/g;
    while ((m = re2.exec(html)) !== null) {
      if (!links.includes(m[1])) links.push(m[1]);
    }
  }
  return links;
}

async function fetchCbdb(query: string, signal: AbortSignal): Promise<BookSearchResult | null> {
  const r1 = await rateLimitedFetch(
    `https://www.cbdb.cz/hledat?text=${encodeURIComponent(query)}`,
    { headers: CZ_BROWSER_HEADERS, redirect: "follow", signal },
  );
  if (!r1.ok) return null;
  const html1 = await r1.text();
  const finalUrl = r1.url;

  if (finalUrl.includes("/kniha-")) {
    const book = parseCbdbBookPage(html1);
    if (book) return toResult(book, query);
  }

  const links = parseCbdbSearchLinks(html1);
  if (!links.length) return null;

  const r2 = await rateLimitedFetch(`https://www.cbdb.cz/${links[0]}`, {
    headers: CZ_BROWSER_HEADERS,
    signal,
  });
  if (!r2.ok) return null;
  const book = parseCbdbBookPage(await r2.text());
  return book ? toResult(book, query) : null;
}

function toResult(b: CbdbBook, queryIsbn: string): BookSearchResult {
  return {
    isbn: b.isbn ?? (/^\d+$/.test(queryIsbn) ? queryIsbn : null),
    title: b.title,
    authors: b.authors,
    genres: b.genres,
    description: b.description,
    publisher: b.publisher,
    pageCount: b.pageCount,
    coverUrl: b.coverUrl,
    averageRating: b.averageRating,
    ratingsCount: b.ratingsCount,
  };
}

export const cbdbPlugin: BookSourcePlugin = {
  id: "cbdb",
  name: "cbdb.cz",
  description: "Czech book database.",
  timeoutMs: 10000,

  async searchByISBN(isbn, signal) {
    return fetchCbdb(isbn, signal);
  },

  async findCovers({ isbn }, signal) {
    if (!isbn) return [];
    const b = await fetchCbdb(isbn, signal);
    return b?.coverUrl ? [b.coverUrl] : [];
  },
};
