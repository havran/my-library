import type { BookSearchResult } from "@/types/book";
import type { BookSourcePlugin } from "../types";

const BASE = "https://www.googleapis.com/books/v1/volumes";

export function parseGoogleBook(item: any): BookSearchResult {
  const v = item.volumeInfo || {};
  const identifiers = v.industryIdentifiers || [];
  const isbn13 = identifiers.find((i: any) => i.type === "ISBN_13");
  const isbn10 = identifiers.find((i: any) => i.type === "ISBN_10");

  const thumbnail = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || "";
  const coverUrl = thumbnail.replace("http:", "https:").replace("zoom=1", "zoom=2");

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

async function query(q: string, signal: AbortSignal, max = 10) {
  const res = await fetch(`${BASE}?q=${q}&maxResults=${max}`, { signal });
  const data = await res.json();
  return (data.items || []) as any[];
}

export const googleBooksPlugin: BookSourcePlugin = {
  id: "google-books",
  name: "Google Books",
  description: "Google's public book metadata index.",
  timeoutMs: 6000,

  async searchByISBN(isbn, signal) {
    const items = await query(`isbn:${isbn}`, signal, 1);
    return items[0] ? parseGoogleBook(items[0]) : null;
  },

  async searchByTitle(title, signal) {
    const items = await query(`intitle:${encodeURIComponent(title)}`, signal);
    return items.map(parseGoogleBook);
  },

  async searchByAuthor(author, signal) {
    const items = await query(`inauthor:${encodeURIComponent(author)}`, signal);
    return items.map(parseGoogleBook);
  },

  async searchByText(text, signal) {
    const items = await query(encodeURIComponent(text), signal);
    return items.map(parseGoogleBook);
  },

  async findCovers({ isbn, title }, signal) {
    const q = isbn ? `isbn:${isbn}` : title ? encodeURIComponent(title) : "";
    if (!q) return [];
    const items = await query(q, signal, 1);
    const thumb = items[0]?.volumeInfo?.imageLinks?.thumbnail as string | undefined;
    if (!thumb) return [];
    return [thumb.replace("http:", "https:").replace("zoom=1", "zoom=2")];
  },
};
