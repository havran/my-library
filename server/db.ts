import Database from "better-sqlite3";
import { join, dirname } from "path";
import { mkdirSync, existsSync, copyFileSync } from "fs";
import { fileURLToPath } from "url";
import type { Book } from "../src/types/book.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = join(process.env.HOME ?? __dirname, ".local", "share", "my-library");
const BACKUP_DIR = join(DATA_DIR, "backups");
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(BACKUP_DIR, { recursive: true });
const DB_PATH = join(DATA_DIR, "library.db");

// Daily backup on startup
if (existsSync(DB_PATH)) {
  const date = new Date().toISOString().slice(0, 10);
  const backupPath = join(BACKUP_DIR, `library-${date}.db`);
  if (!existsSync(backupPath)) copyFileSync(DB_PATH, backupPath);
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS books (
    id           TEXT PRIMARY KEY,
    isbn         TEXT,
    title        TEXT NOT NULL,
    authors      TEXT NOT NULL DEFAULT '[]',
    genres       TEXT NOT NULL DEFAULT '[]',
    description  TEXT NOT NULL DEFAULT '',
    publisher    TEXT NOT NULL DEFAULT '',
    pageCount    INTEGER,
    series       TEXT NOT NULL DEFAULT '',
    seriesNumber TEXT NOT NULL DEFAULT '',
    coverUrl     TEXT NOT NULL DEFAULT '',
    coverBase64  TEXT NOT NULL DEFAULT '',
    averageRating REAL,
    ratingsCount  INTEGER,
    isRead       INTEGER NOT NULL DEFAULT 0,
    notes        TEXT NOT NULL DEFAULT '',
    source       TEXT NOT NULL DEFAULT 'manual',
    addedAt      TEXT NOT NULL,
    updatedAt    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    passwordHash  TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'admin',
    createdAt     TEXT NOT NULL,
    updatedAt     TEXT NOT NULL
  );
`);

export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export function getUserByUsername(username: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
}

export function insertUser(u: UserRow): void {
  db.prepare(
    `INSERT INTO users (id, username, passwordHash, role, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?)`,
  ).run(u.id, u.username, u.passwordHash, u.role, u.createdAt, u.updatedAt);
}

export function updateUserPassword(id: string, passwordHash: string): void {
  db.prepare("UPDATE users SET passwordHash = ?, updatedAt = ? WHERE id = ?").run(
    passwordHash,
    new Date().toISOString(),
    id,
  );
}

function toBook(row: Record<string, unknown>): Book {
  return {
    ...(row as any),
    authors: JSON.parse(row.authors as string),
    genres: JSON.parse(row.genres as string),
    isRead: Boolean(row.isRead),
    pageCount: (row.pageCount as number) ?? null,
    averageRating: (row.averageRating as number) ?? null,
    ratingsCount: (row.ratingsCount as number) ?? null,
  };
}

function serialize(book: Partial<Book>): Record<string, unknown> {
  const row: Record<string, unknown> = { ...book };
  if (book.authors !== undefined) row.authors = JSON.stringify(book.authors);
  if (book.genres !== undefined) row.genres = JSON.stringify(book.genres);
  if (book.isRead !== undefined) row.isRead = book.isRead ? 1 : 0;
  return row;
}

export function getAllBooks(): Book[] {
  return (
    db.prepare("SELECT * FROM books ORDER BY addedAt DESC").all() as Record<string, unknown>[]
  ).map(toBook);
}

export function getBook(id: string): Book | undefined {
  const row = db.prepare("SELECT * FROM books WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? toBook(row) : undefined;
}

export function addBook(book: Book): void {
  const row = serialize(book);
  const cols = Object.keys(row).join(", ");
  const placeholders = Object.keys(row)
    .map(() => "?")
    .join(", ");
  db.prepare(`INSERT INTO books (${cols}) VALUES (${placeholders})`).run(...Object.values(row));
}

export function updateBook(id: string, changes: Partial<Book>): void {
  const row = serialize(changes);
  row.updatedAt = new Date().toISOString();
  const sets = Object.keys(row)
    .map((k) => `${k} = ?`)
    .join(", ");
  db.prepare(`UPDATE books SET ${sets} WHERE id = ?`).run(...Object.values(row), id);
}

export function deleteBook(id: string): void {
  db.prepare("DELETE FROM books WHERE id = ?").run(id);
}

export function searchBooks(query: string): Book[] {
  const like = `%${query.toLowerCase()}%`;
  return (
    db
      .prepare(
        `
    SELECT * FROM books
    WHERE lower(title) LIKE ?
       OR lower(authors) LIKE ?
       OR lower(genres) LIKE ?
       OR isbn LIKE ?
    ORDER BY addedAt DESC
  `,
      )
      .all(like, like, like, query) as Record<string, unknown>[]
  ).map(toBook);
}

export function exportAllBooks(): Book[] {
  return getAllBooks();
}

export function importBooks(books: Book[]): number {
  if (!Array.isArray(books)) throw new Error("Must be an array");
  const valid = books.filter((b) => b && typeof b.id === "string" && typeof b.title === "string");
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO books
      (id, isbn, title, authors, genres, description, publisher, pageCount,
       series, seriesNumber, coverUrl, coverBase64, averageRating, ratingsCount,
       isRead, notes, source, addedAt, updatedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertMany = db.transaction((rows: Book[]) => {
    for (const b of rows) {
      const r = serialize(b);
      stmt.run(
        r.id,
        r.isbn ?? null,
        r.title,
        r.authors,
        r.genres,
        r.description ?? "",
        r.publisher ?? "",
        r.pageCount ?? null,
        r.series ?? "",
        r.seriesNumber ?? "",
        r.coverUrl ?? "",
        r.coverBase64 ?? "",
        r.averageRating ?? null,
        r.ratingsCount ?? null,
        r.isRead ?? 0,
        r.notes ?? "",
        r.source ?? "manual",
        r.addedAt,
        r.updatedAt,
      );
    }
  });
  insertMany(valid);
  return valid.length;
}

export function clearAllBooks(): void {
  db.prepare("DELETE FROM books").run();
}
