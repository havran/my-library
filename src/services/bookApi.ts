import type { BookSearchResult } from "@/types/book";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";
// Czech National Library – public Aleph X-Server, no API key required
const NKP_ALEPH_BASE = "https://aleph.nkp.cz/X";
// cbdb.cz — Czech book database, via server-side proxy (avoids CORS/bot-detection)
const CBDB_PROXY = "/api/cbdb";

// ── Google Books ──────────────────────────────────────────────────────────────

export function parseGoogleBook(item: any): BookSearchResult {
  const v = item.volumeInfo || {};
  const identifiers = v.industryIdentifiers || [];
  const isbn13 = identifiers.find((i: any) => i.type === "ISBN_13");
  const isbn10 = identifiers.find((i: any) => i.type === "ISBN_10");

  // Upgrade thumbnail to larger image
  const thumbnail = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "";
  const coverUrl = thumbnail
    .replace("http:", "https:")
    .replace("zoom=1", "zoom=2");

  return {
    isbn: isbn13?.identifier || isbn10?.identifier || null,
    title: v.title || "Unknown Title",
    authors: v.authors || [],
    genres: v.categories || [],
    description: v.description || "",
    publisher: v.publisher || "",
    pageCount: v.pageCount || null,
    coverUrl,
    averageRating: v.averageRating || null,
    ratingsCount: v.ratingsCount || null,
  };
}

// ── Czech National Library (NKP) — Aleph X-Server ────────────────────────────
// Two-step: (1) find set_number by ISBN, (2) fetch MARC XML record

async function fetchFromNKP(isbn: string): Promise<BookSearchResult | null> {
  const cleanIsbn = isbn.replace(/-/g, "");

  // Step 1 – find record set
  const findRes = await fetch(
    `${NKP_ALEPH_BASE}?op=find&request=sbn=${cleanIsbn}&base=nkc`
  );
  const findXml = await findRes.text();

  const noRecords = parseInt(
    findXml.match(/<no_records>\s*0*(\d+)\s*<\/no_records>/)?.[1] ?? "0"
  );
  if (noRecords === 0) return null;

  const setNumber = findXml.match(/<set_number>\s*0*(\d+)\s*<\/set_number>/)?.[1];
  if (!setNumber) return null;

  // Step 2 – fetch first record in OAI-MARC format
  const presentRes = await fetch(
    `${NKP_ALEPH_BASE}?op=present&set_number=${setNumber}&set_entry=1-1&format=marc&base=nkc`
  );
  const presentXml = await presentRes.text();

  // Parse via DOMParser (browser-native, no dependencies)
  const dom = new DOMParser().parseFromString(presentXml, "text/xml");
  if (dom.querySelector("parsererror")) return null;

  const getSubfields = (fieldId: string, subfieldLabel: string): string[] => {
    const results: string[] = [];
    dom.querySelectorAll(`varfield[id="${fieldId}"]`).forEach((vf) => {
      vf.querySelectorAll(`subfield[label="${subfieldLabel}"]`).forEach((sf) => {
        const t = sf.textContent?.trim();
        if (t) results.push(t);
      });
    });
    return results;
  };
  const sub = (f: string, l: string) => getSubfields(f, l)[0] ?? "";

  // MARC field mapping:
  // 245a/b = title,  100a/700a = authors,  264b/260b = publisher,
  // 300a = pages,    520a = description,   650a = subjects,  020a = ISBN
  const titleA = sub("245", "a").replace(/\s*\/\s*$/, "").trim();
  const titleB = sub("245", "b").replace(/\s*\/\s*$/, "").trim();
  const title = titleB ? `${titleA}: ${titleB}` : titleA;
  if (!title) return null;

  const authors = [sub("100", "a"), ...getSubfields("700", "a")]
    .map((a) => a.replace(/,\s*$/, "").trim())
    .filter(Boolean);

  const publisher = (sub("264", "b") || sub("260", "b"))
    .replace(/,\s*$/, "").trim();

  // "215 stran" / "xv, 386 s." → extract the main number
  const pagesRaw = sub("300", "a");
  const pageCount = parseInt(pagesRaw.match(/(\d+)\s*(?:stran|s\.|pages?)/i)?.[1] ?? "") || null;

  const description = sub("520", "a");

  const genres = getSubfields("650", "a")
    .map((g) => g.replace(/[-–—,\s]+$/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  // ISBN from 020a can include price/qualifier after a space – strip it
  const isbnRaw = sub("020", "a").replace(/\s.*$/, "").replace(/-/g, "");
  const recordIsbn = isbnRaw || cleanIsbn;

  return {
    isbn: recordIsbn,
    title,
    authors,
    genres,
    description,
    publisher,
    pageCount,
    coverUrl: "",   // NKP does not serve cover images
    averageRating: null,
    ratingsCount: null,
  };
}

// ── Open Library ──────────────────────────────────────────────────────────────

async function fetchFromOpenLibrary(isbn: string): Promise<BookSearchResult | null> {
  const res = await fetch(
    `${OPEN_LIBRARY_BASE}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
  );
  const data = await res.json();
  const bookData = data[`ISBN:${isbn}`];
  if (!bookData) return null;

  return {
    isbn,
    title: bookData.title || "Unknown Title",
    authors: (bookData.authors || []).map((a: any) => a.name),
    genres: (bookData.subjects || []).slice(0, 5).map((s: any) => s.name),
    description: bookData.notes || "",
    publisher: bookData.publishers?.[0]?.name || "",
    pageCount: bookData.number_of_pages || null,
    coverUrl: bookData.cover?.large || bookData.cover?.medium || "",
    averageRating: null,
    ratingsCount: null,
  };
}

// ── cbdb.cz (via server proxy) ────────────────────────────────────────────────

async function fetchFromCbdb(isbn: string): Promise<BookSearchResult | null> {
  const res = await fetch(`${CBDB_PROXY}?isbn=${encodeURIComponent(isbn)}`);
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.title) return null;
  return {
    isbn: d.isbn ?? isbn,
    title: d.title,
    authors: d.authors ?? [],
    genres: d.genres ?? [],
    description: d.description ?? "",
    publisher: d.publisher ?? "",
    pageCount: d.pageCount ?? null,
    coverUrl: d.coverUrl ?? "",
    averageRating: d.averageRating ?? null,
    ratingsCount: d.ratingsCount ?? null,
  };
}

// ── legie.info (via server proxy) ────────────────────────────────────────────

interface LegieResult {
  title: string;
  authors: string[];
  coverUrl: string;
  genres: string[];
  averageRating: number | null;
  ratingsCount: number | null;
  series: string;
  seriesNumber: string;
  serieSlug: string;
  description: string;
}

async function fetchFromLegie(title: string): Promise<LegieResult | null> {
  if (!title) return null;
  const res = await fetch(`/api/legie?title=${encodeURIComponent(title)}`);
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.title) return null;
  return d as LegieResult;
}

// ── Public API ────────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return promise
    .then((v) => { clearTimeout(timer); return v; })
    .catch((e) => { clearTimeout(timer); console.warn(`${label} failed:`, e); return null; });
}

export async function fetchByISBN(isbn: string): Promise<BookSearchResult | null> {
  const [google, openLib, nkp, cbdb] = await Promise.all([
    withTimeout(
      fetch(`${GOOGLE_BOOKS_BASE}?q=isbn:${isbn}&maxResults=1`).then(async (res) => {
        const data = await res.json();
        return data.totalItems > 0 && data.items?.[0] ? parseGoogleBook(data.items[0]) : null;
      }),
      6000, "Google Books"
    ),
    withTimeout(fetchFromOpenLibrary(isbn), 6000, "Open Library"),
    withTimeout(fetchFromNKP(isbn), 10000, "NKP Aleph"),
    withTimeout(fetchFromCbdb(isbn), 10000, "cbdb.cz"),
  ]);

  // Priority for metadata: cbdb > NKP > Google > OpenLibrary
  const base = cbdb ?? nkp ?? google ?? openLib;
  if (!base) return null;

  const bestCover = cbdb?.coverUrl || google?.coverUrl || openLib?.coverUrl || "";

  // Enrich with legie.info (rating, Czech genre tags, series, cover)
  const legie = await withTimeout(fetchFromLegie(base.title), 10000, "legie.info");

  return {
    ...base,
    coverUrl: legie?.coverUrl || bestCover,
    genres: legie?.genres?.length ? legie.genres : base.genres,
    averageRating: legie?.averageRating ?? base.averageRating,
    ratingsCount: legie?.ratingsCount ?? base.ratingsCount,
    description: base.description || legie?.description || "",
    series: (base as any).series || legie?.series || "",
    seriesNumber: (base as any).seriesNumber || legie?.seriesNumber || "",
    serieSlug: legie?.serieSlug || "",
  };
}

export async function searchByTitle(query: string): Promise<BookSearchResult[]> {
  try {
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}?q=intitle:${encodeURIComponent(query)}&maxResults=10`
    );
    const data = await res.json();
    if (data.items) return data.items.map(parseGoogleBook);
  } catch (e) {
    console.warn("Google Books title search failed:", e);
  }
  return [];
}

export async function searchByText(query: string): Promise<BookSearchResult[]> {
  try {
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(query)}&maxResults=10`
    );
    const data = await res.json();
    if (data.items) return data.items.map(parseGoogleBook);
  } catch (e) {
    console.warn("Google Books text search failed:", e);
  }
  return [];
}
