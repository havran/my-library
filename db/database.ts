import Dexie, { type EntityTable } from "dexie";
import type { Book } from "@/types/book";

const db = new Dexie("MyLibraryDB") as Dexie & {
  books: EntityTable<Book, "id">;
};

db.version(1).stores({
  books: "id, title, *authors, *genres, addedAt, isRead, isbn",
});

export async function getAllBooks(): Promise<Book[]> {
  return db.books.toArray();
}

export async function getBook(id: string): Promise<Book | undefined> {
  return db.books.get(id);
}

export async function addBook(book: Book): Promise<string> {
  return db.books.add(book);
}

export async function updateBook(
  id: string,
  changes: Partial<Book>
): Promise<number> {
  return db.books.update(id, { ...changes, updatedAt: new Date().toISOString() });
}

export async function deleteBook(id: string): Promise<void> {
  return db.books.delete(id);
}

export async function searchBooks(query: string): Promise<Book[]> {
  const lower = query.toLowerCase();
  const all = await db.books.toArray();
  return all.filter(
    (b) =>
      b.title.toLowerCase().includes(lower) ||
      b.authors.some((a) => a.toLowerCase().includes(lower)) ||
      b.genres.some((g) => g.toLowerCase().includes(lower)) ||
      (b.isbn && b.isbn.includes(query))
  );
}

export async function bulkAddBooks(books: Book[]): Promise<void> {
  await db.books.bulkPut(books);
}

export async function exportAllBooks(): Promise<string> {
  const books = await db.books.toArray();
  return JSON.stringify(books, null, 2);
}

export async function importBooks(json: string): Promise<number> {
  const books: Book[] = JSON.parse(json);
  await db.books.bulkPut(books);
  return books.length;
}

export async function clearAllBooks(): Promise<void> {
  await db.books.clear();
}

export { db };
