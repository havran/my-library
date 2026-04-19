import type { Book } from "@/types/book";

const API = "/api";

export async function getAllBooks(): Promise<Book[]> {
  const res = await fetch(`${API}/books`);
  return res.json();
}

export async function getBook(id: string): Promise<Book | undefined> {
  const res = await fetch(`${API}/books/${id}`);
  if (res.status === 404) return undefined;
  return res.json();
}

export async function addBook(book: Book): Promise<void> {
  await fetch(`${API}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(book),
  });
}

export async function updateBook(id: string, changes: Partial<Book>): Promise<void> {
  await fetch(`${API}/books/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(changes),
  });
}

export async function deleteBook(id: string): Promise<void> {
  await fetch(`${API}/books/${id}`, { method: "DELETE" });
}

export async function searchBooks(query: string): Promise<Book[]> {
  const res = await fetch(`${API}/books/search?q=${encodeURIComponent(query)}`);
  return res.json();
}

export async function exportAllBooks(): Promise<string> {
  const res = await fetch(`${API}/export`);
  const books = await res.json();
  return JSON.stringify(books, null, 2);
}

export async function importBooks(json: string): Promise<number> {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("Import data must be an array");
  const res = await fetch(`${API}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });
  if (!res.ok) throw new Error(await res.text());
  const { count } = await res.json();
  return count;
}

export async function clearAllBooks(): Promise<void> {
  await fetch(`${API}/books`, { method: "DELETE" });
}
