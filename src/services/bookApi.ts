import type { BookSearchResult } from "@/types/book";
import { runByISBN, runByTitle, runByText, runByAuthor, runBySeries } from "./plugins";

export { parseGoogleBook } from "./plugins/sources/googleBooks";

export async function fetchByISBN(isbn: string): Promise<BookSearchResult | null> {
  return runByISBN(isbn);
}

export async function searchByTitle(query: string): Promise<BookSearchResult[]> {
  return runByTitle(query);
}

export async function searchByText(query: string): Promise<BookSearchResult[]> {
  return runByText(query);
}

export async function searchByAuthor(query: string): Promise<BookSearchResult[]> {
  return runByAuthor(query);
}

export async function searchBySeries(query: string): Promise<BookSearchResult[]> {
  return runBySeries(query);
}
