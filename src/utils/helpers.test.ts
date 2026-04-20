import { describe, it, expect } from "vitest";
import { generateId, sortBooks, filterBooks, getGenreCounts } from "./helpers";
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

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 200 }, () => generateId()));
    expect(ids.size).toBe(200);
  });
});

describe("sortBooks", () => {
  const books = [
    makeBook({
      id: "1",
      title: "Zebra",
      authors: ["Charlie"],
      genres: ["Sci-Fi"],
      addedAt: "2024-01-03T00:00:00.000Z",
    }),
    makeBook({
      id: "2",
      title: "Apple",
      authors: ["Alice"],
      genres: ["Fiction"],
      addedAt: "2024-01-01T00:00:00.000Z",
    }),
    makeBook({
      id: "3",
      title: "Mango",
      authors: ["Bob"],
      genres: ["Horror"],
      addedAt: "2024-01-02T00:00:00.000Z",
    }),
  ];

  it("sorts by title ascending", () => {
    const result = sortBooks(books, "title", "asc");
    expect(result.map((b) => b.title)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("sorts by title descending", () => {
    const result = sortBooks(books, "title", "desc");
    expect(result.map((b) => b.title)).toEqual(["Zebra", "Mango", "Apple"]);
  });

  it("sorts by authors ascending", () => {
    const result = sortBooks(books, "authors", "asc");
    expect(result.map((b) => b.authors[0])).toEqual(["Alice", "Bob", "Charlie"]);
  });

  it("sorts by genres ascending", () => {
    const result = sortBooks(books, "genres", "asc");
    expect(result.map((b) => b.genres[0])).toEqual(["Fiction", "Horror", "Sci-Fi"]);
  });

  it("sorts by addedAt descending (newest first)", () => {
    const result = sortBooks(books, "addedAt", "desc");
    expect(result.map((b) => b.id)).toEqual(["1", "3", "2"]);
  });

  it("does not mutate the original array", () => {
    const original = [...books];
    sortBooks(books, "title", "asc");
    expect(books.map((b) => b.id)).toEqual(original.map((b) => b.id));
  });

  it("handles books with missing authors gracefully", () => {
    const booksWithEmpty = [
      makeBook({ id: "a", authors: [] }),
      makeBook({ id: "b", authors: ["Alpha"] }),
    ];
    const result = sortBooks(booksWithEmpty, "authors", "asc");
    expect(result[0].id).toBe("a");
  });

  it("handles books with missing genres gracefully", () => {
    const booksWithEmpty = [
      makeBook({ id: "a", genres: [] }),
      makeBook({ id: "b", genres: ["Zulu"] }),
    ];
    const result = sortBooks(booksWithEmpty, "genres", "asc");
    expect(result[0].id).toBe("a");
  });

  it("returns empty array unchanged", () => {
    expect(sortBooks([], "title", "asc")).toEqual([]);
  });
});

describe("filterBooks", () => {
  const books = [
    makeBook({
      id: "1",
      title: "The Hobbit",
      authors: ["J.R.R. Tolkien"],
      genres: ["Fantasy"],
      isbn: "9780261102217",
    }),
    makeBook({ id: "2", title: "Dune", authors: ["Frank Herbert"], genres: ["Sci-Fi"] }),
    makeBook({
      id: "3",
      title: "Neuromancer",
      authors: ["William Gibson"],
      genres: ["Cyberpunk", "Sci-Fi"],
    }),
  ];

  it("returns all books for empty query", () => {
    expect(filterBooks(books, "")).toHaveLength(3);
  });

  it("returns all books for whitespace-only query", () => {
    expect(filterBooks(books, "   ")).toHaveLength(3);
  });

  it("filters by title (case insensitive)", () => {
    expect(filterBooks(books, "hobbit")).toHaveLength(1);
    expect(filterBooks(books, "HOBBIT")).toHaveLength(1);
  });

  it("filters by author", () => {
    expect(filterBooks(books, "tolkien")).toHaveLength(1);
    expect(filterBooks(books, "Herbert")).toHaveLength(1);
  });

  it("filters by genre across multiple books", () => {
    const result = filterBooks(books, "Sci-Fi");
    expect(result).toHaveLength(2);
  });

  it("filters by ISBN", () => {
    const result = filterBooks(books, "9780261102217");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty array when no match", () => {
    expect(filterBooks(books, "zzznomatch")).toHaveLength(0);
  });

  it("matches partial title strings", () => {
    expect(filterBooks(books, "neuro")).toHaveLength(1);
    expect(filterBooks(books, "neuro")[0].id).toBe("3");
  });

  it("does not filter by ISBN when isbn is null", () => {
    const booksWithNull = [makeBook({ id: "x", isbn: null, title: "X" })];
    expect(filterBooks(booksWithNull, "123")).toHaveLength(0);
  });
});

describe("getGenreCounts", () => {
  it("returns empty object for empty array", () => {
    expect(getGenreCounts([])).toEqual({});
  });

  it("counts a single genre across multiple books", () => {
    const books = [makeBook({ genres: ["Fiction"] }), makeBook({ genres: ["Fiction"] })];
    expect(getGenreCounts(books)).toEqual({ Fiction: 2 });
  });

  it("counts multiple genres per book independently", () => {
    const books = [makeBook({ genres: ["Fiction", "Romance"] }), makeBook({ genres: ["Fiction"] })];
    expect(getGenreCounts(books)).toEqual({ Fiction: 2, Romance: 1 });
  });

  it("handles books with no genres", () => {
    const books = [makeBook({ genres: [] }), makeBook({ genres: ["Sci-Fi"] })];
    expect(getGenreCounts(books)).toEqual({ "Sci-Fi": 1 });
  });

  it("handles all distinct genres", () => {
    const books = [
      makeBook({ genres: ["A"] }),
      makeBook({ genres: ["B"] }),
      makeBook({ genres: ["C"] }),
    ];
    const counts = getGenreCounts(books);
    expect(counts).toEqual({ A: 1, B: 1, C: 1 });
  });
});
