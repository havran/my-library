import type { BookSearchResult } from "@/types/book";
import type { BookSourcePlugin } from "../types";
import { apiFetch } from "@/services/apiFetch";

const PROXY = "/api/databazeknih";

async function fetchDbk(
  param: "isbn" | "q",
  value: string,
  signal: AbortSignal,
): Promise<BookSearchResult | null> {
  const res = await apiFetch(`${PROXY}?${param}=${encodeURIComponent(value)}`, { signal });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.title) return null;
  return {
    isbn: d.isbn ?? (param === "isbn" ? value : null),
    title: d.title,
    authors: d.authors ?? [],
    genres: d.genres ?? [],
    description: d.description ?? "",
    publisher: d.publisher ?? "",
    pageCount: d.pageCount ?? null,
    coverUrl: d.coverUrl ?? "",
    averageRating: d.averageRating ?? null,
    ratingsCount: d.ratingsCount ?? null,
    series: d.series ?? "",
    seriesNumber: d.seriesNumber ?? "",
  };
}

export const databazeknihPlugin: BookSourcePlugin = {
  id: "databazeknih",
  name: "databazeknih.cz",
  description: "Czech book database (via server proxy).",
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
};
