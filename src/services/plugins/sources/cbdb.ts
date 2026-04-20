import type { BookSearchResult } from "@/types/book";
import type { BookSourcePlugin } from "../types";
import { apiFetch } from "@/services/apiFetch";

const PROXY = "/api/cbdb";

async function fetchCbdb(isbn: string, signal: AbortSignal): Promise<BookSearchResult | null> {
  const res = await apiFetch(`${PROXY}?isbn=${encodeURIComponent(isbn)}`, { signal });
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

export const cbdbPlugin: BookSourcePlugin = {
  id: "cbdb",
  name: "cbdb.cz",
  description: "Czech book database (via server proxy).",
  timeoutMs: 10000,

  searchByISBN: fetchCbdb,

  async findCovers({ isbn }, signal) {
    if (!isbn) return [];
    const b = await fetchCbdb(isbn, signal);
    return b?.coverUrl ? [b.coverUrl] : [];
  },
};
