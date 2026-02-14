import type { BookSearchResult } from "@/types/book";

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_BASE = "https://openlibrary.org";

function parseGoogleBook(item: any): BookSearchResult {
  const v = item.volumeInfo || {};
  const identifiers = v.industryIdentifiers || [];
  const isbn13 = identifiers.find((i: any) => i.type === "ISBN_13");
  const isbn10 = identifiers.find((i: any) => i.type === "ISBN_10");

  return {
    isbn: isbn13?.identifier || isbn10?.identifier || null,
    title: v.title || "Unknown Title",
    authors: v.authors || [],
    genres: v.categories || [],
    description: v.description || "",
    publisher: v.publisher || "",
    pageCount: v.pageCount || null,
    coverUrl: v.imageLinks?.thumbnail?.replace("http:", "https:") || "",
    averageRating: v.averageRating || null,
    ratingsCount: v.ratingsCount || null,
  };
}

export async function fetchByISBN(
  isbn: string
): Promise<BookSearchResult | null> {
  // Try Google Books first
  try {
    const res = await fetch(`${GOOGLE_BOOKS_BASE}?q=isbn:${isbn}`);
    const data = await res.json();
    if (data.totalItems > 0 && data.items?.[0]) {
      return parseGoogleBook(data.items[0]);
    }
  } catch (e) {
    console.warn("Google Books API failed:", e);
  }

  // Fallback to Open Library
  try {
    const res = await fetch(
      `${OPEN_LIBRARY_BASE}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await res.json();
    const bookData = data[`ISBN:${isbn}`];
    if (bookData) {
      return {
        isbn,
        title: bookData.title || "Unknown Title",
        authors: (bookData.authors || []).map((a: any) => a.name),
        genres: (bookData.subjects || []).slice(0, 5).map((s: any) => s.name),
        description: bookData.notes || "",
        publisher: bookData.publishers?.[0]?.name || "",
        pageCount: bookData.number_of_pages || null,
        coverUrl: bookData.cover?.medium || bookData.cover?.small || "",
        averageRating: null,
        ratingsCount: null,
      };
    }
  } catch (e) {
    console.warn("Open Library API failed:", e);
  }

  return null;
}

export async function searchByTitle(
  query: string
): Promise<BookSearchResult[]> {
  try {
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}?q=intitle:${encodeURIComponent(query)}&maxResults=10`
    );
    const data = await res.json();
    if (data.items) {
      return data.items.map(parseGoogleBook);
    }
  } catch (e) {
    console.warn("Google Books search failed:", e);
  }
  return [];
}

export async function searchByText(
  query: string
): Promise<BookSearchResult[]> {
  try {
    const res = await fetch(
      `${GOOGLE_BOOKS_BASE}?q=${encodeURIComponent(query)}&maxResults=10`
    );
    const data = await res.json();
    if (data.items) {
      return data.items.map(parseGoogleBook);
    }
  } catch (e) {
    console.warn("Google Books text search failed:", e);
  }
  return [];
}
