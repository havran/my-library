import { searchByText } from "./bookApi";
import { fetchImageAsBase64 } from "./imageCache";
import type { BookSearchResult } from "@/types/book";

export interface OCRResult {
  results: BookSearchResult[];
  query: string;
}

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 5000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function tryImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => { img.src = ""; resolve(false); }, 5000);
    img.onload = () => { clearTimeout(timer); resolve(true); };
    img.onerror = () => { clearTimeout(timer); resolve(false); };
    img.src = url;
  });
}

/** Find a cover image URL for a book by ISBN, falling back to title search. */
export async function searchCoverByISBN(isbn: string, title: string): Promise<string> {
  // 1. cbdb.cz — best Czech covers (via server proxy)
  if (isbn) {
    try {
      const res = await fetchWithTimeout(`/api/cbdb?isbn=${encodeURIComponent(isbn)}`, {}, 10000);
      const data = await res.json();
      const coverUrl = data?.coverUrl;
      if (coverUrl && await tryImageUrl(coverUrl)) return coverUrl;
    } catch {}
  }

  // 2. Open Library — ?default=false returns 404 if no cover exists
  if (isbn) {
    const olUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
    if (await tryImageUrl(olUrl)) return olUrl;
  }

  // 3. obalkyknih.cz — Czech cover database
  if (isbn) {
    try {
      const res = await fetchWithTimeout(
        `https://www.obalkyknih.cz/api/books?isbn=${isbn}&keywords=`
      );
      const data = await res.json();
      const coverUrl = data?.[0]?.cover_medium_url || data?.[0]?.thumbnail_url;
      if (coverUrl && await tryImageUrl(coverUrl)) return coverUrl;
    } catch {}
  }

  // 4. Google Books — re-query for cover
  try {
    const query = isbn ? `isbn:${isbn}` : encodeURIComponent(title);
    const res = await fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=1`
    );
    const data = await res.json();
    const thumb = data?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail;
    if (thumb) return thumb.replace("http:", "https:").replace("zoom=1", "zoom=2");
  } catch {}

  return "";
}

/** Search all sources in parallel and return valid cover URLs ordered: legie → cbdb → others. */
export async function searchAllCovers(isbn: string, title: string): Promise<string[]> {
  const [legieData, cbdbUrl, olUrl, obalkUrl, googleUrl] = await Promise.all([
    // 1. legie.info — edition covers (best Czech/Slovak source)
    title
      ? fetchWithTimeout(`/api/legie?title=${encodeURIComponent(title)}`, {}, 12000)
          .then((r) => r.json())
          .then((d) => ({
            editionUrls: ((d?.editions as { coverUrl: string }[]) ?? []).map((e) => e.coverUrl),
            mainUrl: (d?.coverUrl as string) || "",
          }))
          .catch(() => ({ editionUrls: [], mainUrl: "" }))
      : Promise.resolve({ editionUrls: [], mainUrl: "" }),

    // 2. cbdb.cz
    isbn
      ? fetchWithTimeout(`/api/cbdb?isbn=${encodeURIComponent(isbn)}`, {}, 10000)
          .then((r) => r.json())
          .then((d) => (d?.coverUrl as string) || "")
          .catch(() => "")
      : Promise.resolve(""),

    // 3. Open Library
    isbn
      ? Promise.resolve(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`)
      : Promise.resolve(""),

    // 4. obalkyknih.cz
    isbn
      ? fetchWithTimeout(`https://www.obalkyknih.cz/api/books?isbn=${isbn}&keywords=`)
          .then((r) => r.json())
          .then((d) => (d?.[0]?.cover_medium_url || d?.[0]?.thumbnail_url || "") as string)
          .catch(() => "")
      : Promise.resolve(""),

    // 5. Google Books
    fetchWithTimeout(
      `https://www.googleapis.com/books/v1/volumes?q=${isbn ? `isbn:${isbn}` : encodeURIComponent(title)}&maxResults=1`
    )
      .then((r) => r.json())
      .then((d) => {
        const thumb = (d?.items?.[0]?.volumeInfo?.imageLinks?.thumbnail as string) || "";
        return thumb ? thumb.replace("http:", "https:").replace("zoom=1", "zoom=2") : "";
      })
      .catch(() => ""),
  ]);

  // Ordered: legie editions, legie main, cbdb, open library, obalkyknih, google
  const ordered = [
    ...legieData.editionUrls,
    legieData.mainUrl,
    cbdbUrl,
    olUrl,
    obalkUrl,
    googleUrl,
  ].filter(Boolean);

  const unique = [...new Set(ordered)];

  // Validate all in parallel, preserve order
  const results = await Promise.all(unique.map(async (url) => ({ url, ok: await tryImageUrl(url) })));
  return results.filter((r) => r.ok).map((r) => r.url);
}

/** Download a cover URL as base64 data URI. */
export async function downloadCover(url: string): Promise<string> {
  return fetchImageAsBase64(url);
}

export async function searchByOCR(imageUrl: string): Promise<OCRResult> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const { data: { text } } = await worker.recognize(imageUrl);
    await worker.terminate();

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 1 && /\p{L}/u.test(l));

    const query = lines.slice(0, 4).join(" ").substring(0, 100);
    if (!query) return { results: [], query: "" };

    const results = await searchByText(query);
    return { results, query };
  } catch (e) {
    console.warn("OCR failed:", e);
    return { results: [], query: "" };
  }
}
