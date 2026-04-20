import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAllBooks,
  getBook,
  addBook,
  updateBook,
  deleteBook,
  searchBooks,
  exportAllBooks,
  importBooks,
  clearAllBooks,
} from "./database";
import type { Book } from "@/types/book";

function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "test-id",
    isbn: null,
    title: "Test Book",
    authors: ["Test Author"],
    genres: ["Fiction"],
    description: "",
    publisher: "",
    pageCount: null,
    series: "",
    seriesNumber: "",
    coverUrl: "",
    coverBase64: "",
    averageRating: null,
    ratingsCount: null,
    isRead: false,
    notes: "",
    source: "manual",
    addedAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
afterEach(() => vi.unstubAllGlobals());

describe("getAllBooks", () => {
  it("GET /api/books and returns array", async () => {
    const books = [makeBook({ id: "1" })];
    vi.mocked(fetch).mockImplementation(mockFetch(books));
    expect(await getAllBooks()).toEqual(books);
    expect(fetch).toHaveBeenCalledWith("/api/books", undefined);
  });
});

describe("getBook", () => {
  it("GET /api/books/:id and returns book", async () => {
    const book = makeBook({ id: "abc" });
    vi.mocked(fetch).mockImplementation(mockFetch(book));
    expect(await getBook("abc")).toEqual(book);
    expect(fetch).toHaveBeenCalledWith("/api/books/abc", undefined);
  });

  it("returns undefined on 404", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch({}, 404));
    expect(await getBook("nope")).toBeUndefined();
  });
});

describe("addBook", () => {
  it("POST /api/books with book as JSON body", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch({ ok: true }));
    const book = makeBook();
    await addBook(book);
    expect(fetch).toHaveBeenCalledWith(
      "/api/books",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(book),
      }),
    );
  });
});

describe("updateBook", () => {
  it("PUT /api/books/:id with changes as JSON body", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch({ ok: true }));
    await updateBook("u1", { title: "Updated" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/books/u1",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ title: "Updated" }),
      }),
    );
  });
});

describe("deleteBook", () => {
  it("DELETE /api/books/:id", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch({ ok: true }));
    await deleteBook("d1");
    expect(fetch).toHaveBeenCalledWith("/api/books/d1", { method: "DELETE" });
  });
});

describe("searchBooks", () => {
  it("GET /api/books/search with encoded query", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch([]));
    await searchBooks("tolkien fantasy");
    expect(fetch).toHaveBeenCalledWith("/api/books/search?q=tolkien%20fantasy", undefined);
  });
});

describe("exportAllBooks", () => {
  it("GET /api/export and returns formatted JSON string", async () => {
    const books = [makeBook({ id: "e1" })];
    vi.mocked(fetch).mockImplementation(mockFetch(books));
    const result = await exportAllBooks();
    expect(JSON.parse(result)).toEqual(books);
  });
});

describe("importBooks", () => {
  it("POST /api/import with array body and returns count", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch({ count: 2 }));
    const books = [makeBook({ id: "i1" }), makeBook({ id: "i2" })];
    const count = await importBooks(JSON.stringify(books));
    expect(count).toBe(2);
    expect(fetch).toHaveBeenCalledWith("/api/import", expect.objectContaining({ method: "POST" }));
  });

  it("throws on invalid JSON without calling fetch", async () => {
    await expect(importBooks("not-json")).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws when JSON is not an array", async () => {
    await expect(importBooks('{"title":"not array"}')).rejects.toThrow("must be an array");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws when server returns error", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch("Invalid data", 400));
    await expect(importBooks(JSON.stringify([makeBook()]))).rejects.toThrow();
  });
});

describe("clearAllBooks", () => {
  it("DELETE /api/books", async () => {
    vi.mocked(fetch).mockImplementation(mockFetch({ ok: true }));
    await clearAllBooks();
    expect(fetch).toHaveBeenCalledWith("/api/books", { method: "DELETE" });
  });
});
