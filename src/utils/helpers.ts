import type { Book, BookSortField, SortDirection } from "@/types/book";

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function sortBooks(books: Book[], field: BookSortField, direction: SortDirection): Book[] {
  return [...books].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "title":   cmp = a.title.localeCompare(b.title); break;
      case "authors": cmp = (a.authors[0] || "").localeCompare(b.authors[0] || ""); break;
      case "genres":  cmp = (a.genres[0] || "").localeCompare(b.genres[0] || ""); break;
      case "addedAt": cmp = a.addedAt.localeCompare(b.addedAt); break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
}

export function filterBooks(books: Book[], query: string): Book[] {
  if (!query.trim()) return books;
  const lower = query.toLowerCase();
  return books.filter(
    (b) =>
      b.title.toLowerCase().includes(lower) ||
      b.authors.some((a) => a.toLowerCase().includes(lower)) ||
      b.genres.some((g) => g.toLowerCase().includes(lower)) ||
      (b.isbn && b.isbn.includes(query))
  );
}

export function getGenreCounts(books: Book[]): Record<string, number> {
  const counts: Record<string, number> = {};
  books.forEach((book) => {
    book.genres.forEach((genre) => {
      counts[genre] = (counts[genre] || 0) + 1;
    });
  });
  return counts;
}
