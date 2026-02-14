export interface Book {
  id: string;
  isbn: string | null;
  title: string;
  authors: string[];
  genres: string[];
  description: string;
  publisher: string;
  pageCount: number | null;
  series: string;
  seriesNumber: string;
  coverUrl: string;
  coverBase64: string;
  averageRating: number | null;
  ratingsCount: number | null;
  isRead: boolean;
  notes: string;
  source: "scan" | "cover" | "manual" | "search";
  addedAt: string;
  updatedAt: string;
}

export type BookSortField = "title" | "authors" | "addedAt" | "genres";
export type SortDirection = "asc" | "desc";

export interface BookSearchResult {
  isbn: string | null;
  title: string;
  authors: string[];
  genres: string[];
  description: string;
  publisher: string;
  pageCount: number | null;
  coverUrl: string;
  averageRating: number | null;
  ratingsCount: number | null;
}
