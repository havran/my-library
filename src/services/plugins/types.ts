import type { BookSearchResult } from "@/types/book";

export type SearchCapability = "isbn" | "title" | "author" | "series" | "text" | "cover";

export interface CoverSearchContext {
  isbn?: string;
  title?: string;
  authors?: string[];
}

export interface BookSourcePlugin {
  id: string;
  name: string;
  description?: string;
  timeoutMs?: number;

  searchByISBN?(isbn: string, signal: AbortSignal): Promise<BookSearchResult | null>;
  searchByTitle?(title: string, signal: AbortSignal): Promise<BookSearchResult[]>;
  searchByAuthor?(author: string, signal: AbortSignal): Promise<BookSearchResult[]>;
  searchBySeries?(series: string, signal: AbortSignal): Promise<BookSearchResult[]>;
  searchByText?(text: string, signal: AbortSignal): Promise<BookSearchResult[]>;
  findCovers?(ctx: CoverSearchContext, signal: AbortSignal): Promise<string[]>;
}

export function getCapabilities(p: BookSourcePlugin): SearchCapability[] {
  const caps: SearchCapability[] = [];
  if (p.searchByISBN) caps.push("isbn");
  if (p.searchByTitle) caps.push("title");
  if (p.searchByAuthor) caps.push("author");
  if (p.searchBySeries) caps.push("series");
  if (p.searchByText) caps.push("text");
  if (p.findCovers) caps.push("cover");
  return caps;
}
