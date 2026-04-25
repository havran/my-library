import type { BookSearchResult } from "@/types/book";
import { apiFetch } from "./apiFetch";

interface IsbnResponse {
  book: BookSearchResult | null;
  sources: { id: string; status: string; ms: number; attempt?: "primary" | "alt" }[];
}

interface ListResponse {
  results: BookSearchResult[];
  sources: { id: string; status: string; ms: number }[];
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await apiFetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchByISBN(isbn: string): Promise<BookSearchResult | null> {
  const data = await getJson<IsbnResponse>(`/api/metadata?mode=isbn&q=${encodeURIComponent(isbn)}`);
  return data?.book ?? null;
}

export async function searchByTitle(query: string): Promise<BookSearchResult[]> {
  const data = await getJson<ListResponse>(
    `/api/metadata?mode=title&q=${encodeURIComponent(query)}`,
  );
  return data?.results ?? [];
}

export async function searchByAuthor(query: string): Promise<BookSearchResult[]> {
  const data = await getJson<ListResponse>(
    `/api/metadata?mode=author&q=${encodeURIComponent(query)}`,
  );
  return data?.results ?? [];
}

export async function searchBySeries(query: string): Promise<BookSearchResult[]> {
  const data = await getJson<ListResponse>(
    `/api/metadata?mode=series&q=${encodeURIComponent(query)}`,
  );
  return data?.results ?? [];
}

export async function searchByText(query: string): Promise<BookSearchResult[]> {
  const data = await getJson<ListResponse>(
    `/api/metadata?mode=text&q=${encodeURIComponent(query)}`,
  );
  return data?.results ?? [];
}

export async function searchEditions(query: string): Promise<BookSearchResult[]> {
  const data = await getJson<ListResponse>(
    `/api/metadata?mode=editions&q=${encodeURIComponent(query)}`,
  );
  return data?.results ?? [];
}
