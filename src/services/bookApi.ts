import type { BookSearchResult } from "@/types/book";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";
// Czech National Library – public Aleph X-Server, no API key required
const NKP_ALEPH_BASE = "https://aleph.nkp.cz/X";

// ── Google Books ──────────────────────────────────────────────────────────────

function parseGoogleBook(item: any): BookSearchResult {
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch book by ISBN.
 * Fallback chain: Google Books → Open Library → NKP Czech National Library
 */
export async function fetchByISBN(isbn: string): Promise<BookSearchResult | null> {
  // 1. Google Books
  try {
    const res = await fetch(`${GOOGLE_BOOKS_BASE}?q=isbn:${isbn}&maxResults=1`);
    const data = await res.json();
    if (data.totalItems > 0 && data.items?.[0]) {
      return parseGoogleBook(data.items[0]);
    }
  } catch (e) {
    console.warn("Google Books failed:", e);
  }

  // 2. Open Library
  try {
    const result = await fetchFromOpenLibrary(isbn);
    if (result) return result;
  } catch (e) {
    console.warn("Open Library failed:", e);
  }

  // 3. Czech National Library (NKP) — covers Czech & Slovak books not in global databases
  try {
    const result = await fetchFromNKP(isbn);
    if (result) return result;
  } catch (e) {
    // NKP may reject cross-origin requests in some environments
    console.warn("NKP Aleph failed:", e);
  }

  return null;
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
