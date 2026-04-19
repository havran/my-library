import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/db/database", () => ({
  getAllBooks: vi.fn(),
  addBook: vi.fn(),
  updateBook: vi.fn(),
  deleteBook: vi.fn(),
  exportAllBooks: vi.fn(),
  importBooks: vi.fn(),
}));

import { useLibraryStore } from "./useLibraryStore";
import * as database from "@/db/database";
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

beforeEach(() => {
  useLibraryStore.setState({
    books: [],
    searchQuery: "",
    sortField: "addedAt",
    sortDirection: "desc",
    theme: "light",
    isLoading: false,
  });
  localStorage.clear();
  vi.clearAllMocks();
});

describe("loadBooks", () => {
  it("loads books from database into state", async () => {
    const mockBooks = [makeBook({ id: "1" }), makeBook({ id: "2" })];
    vi.mocked(database.getAllBooks).mockResolvedValueOnce(mockBooks);

    await useLibraryStore.getState().loadBooks();

    expect(useLibraryStore.getState().books).toEqual(mockBooks);
    expect(useLibraryStore.getState().isLoading).toBe(false);
  });

  it("sets isLoading true during load, then false after", async () => {
    let resolve: (v: Book[]) => void;
    const pending = new Promise<Book[]>((r) => { resolve = r; });
    vi.mocked(database.getAllBooks).mockReturnValueOnce(pending);

    const load = useLibraryStore.getState().loadBooks();
    expect(useLibraryStore.getState().isLoading).toBe(true);

    resolve!([]);
    await load;
    expect(useLibraryStore.getState().isLoading).toBe(false);
  });
});

describe("addBook", () => {
  it("appends the book to state and calls database", async () => {
    vi.mocked(database.addBook).mockResolvedValueOnce(undefined);
    const book = makeBook({ id: "new1", title: "New Book" });

    await useLibraryStore.getState().addBook(book);

    expect(database.addBook).toHaveBeenCalledWith(book);
    expect(useLibraryStore.getState().books).toContainEqual(book);
  });
});

describe("deleteBook", () => {
  it("removes the book from state and calls database", async () => {
    vi.mocked(database.deleteBook).mockResolvedValueOnce(undefined);
    const book = makeBook({ id: "del1" });
    useLibraryStore.setState({ books: [book] });

    await useLibraryStore.getState().deleteBook("del1");

    expect(database.deleteBook).toHaveBeenCalledWith("del1");
    expect(useLibraryStore.getState().books).toHaveLength(0);
  });

  it("does not remove other books", async () => {
    vi.mocked(database.deleteBook).mockResolvedValueOnce(undefined);
    const keep = makeBook({ id: "keep" });
    const del = makeBook({ id: "del2" });
    useLibraryStore.setState({ books: [keep, del] });

    await useLibraryStore.getState().deleteBook("del2");
    expect(useLibraryStore.getState().books).toContainEqual(keep);
  });
});

describe("updateBook", () => {
  it("updates the matching book in state and calls database", async () => {
    vi.mocked(database.updateBook).mockResolvedValueOnce(undefined);
    const book = makeBook({ id: "upd1", title: "Original" });
    useLibraryStore.setState({ books: [book] });

    await useLibraryStore.getState().updateBook("upd1", { title: "Updated" });

    expect(database.updateBook).toHaveBeenCalledWith("upd1", { title: "Updated" });
    const updated = useLibraryStore.getState().books.find((b) => b.id === "upd1");
    expect(updated?.title).toBe("Updated");
  });

  it("sets updatedAt on the updated book", async () => {
    vi.mocked(database.updateBook).mockResolvedValueOnce(undefined);
    const book = makeBook({ id: "upd2", updatedAt: "2020-01-01T00:00:00.000Z" });
    useLibraryStore.setState({ books: [book] });

    const before = new Date().toISOString();
    await useLibraryStore.getState().updateBook("upd2", { isRead: true });
    const updated = useLibraryStore.getState().books.find((b) => b.id === "upd2");
    expect(updated!.updatedAt >= before).toBe(true);
  });
});

describe("toggleRead", () => {
  it("flips isRead from false to true", async () => {
    vi.mocked(database.updateBook).mockResolvedValueOnce(undefined);
    useLibraryStore.setState({ books: [makeBook({ id: "r1", isRead: false })] });

    await useLibraryStore.getState().toggleRead("r1");

    expect(useLibraryStore.getState().books[0].isRead).toBe(true);
    expect(database.updateBook).toHaveBeenCalledWith("r1", { isRead: true });
  });

  it("flips isRead from true to false", async () => {
    vi.mocked(database.updateBook).mockResolvedValueOnce(undefined);
    useLibraryStore.setState({ books: [makeBook({ id: "r2", isRead: true })] });

    await useLibraryStore.getState().toggleRead("r2");

    expect(useLibraryStore.getState().books[0].isRead).toBe(false);
  });

  it("does nothing when book id does not exist", async () => {
    await useLibraryStore.getState().toggleRead("nonexistent");
    expect(database.updateBook).not.toHaveBeenCalled();
  });
});

describe("setSearchQuery / setSortField / setSortDirection", () => {
  it("updates searchQuery", () => {
    useLibraryStore.getState().setSearchQuery("tolkien");
    expect(useLibraryStore.getState().searchQuery).toBe("tolkien");
  });

  it("updates sortField", () => {
    useLibraryStore.getState().setSortField("title");
    expect(useLibraryStore.getState().sortField).toBe("title");
  });

  it("updates sortDirection", () => {
    useLibraryStore.getState().setSortDirection("asc");
    expect(useLibraryStore.getState().sortDirection).toBe("asc");
  });
});

describe("toggleTheme", () => {
  it("switches from light to dark", () => {
    useLibraryStore.setState({ theme: "light" });
    useLibraryStore.getState().toggleTheme();
    expect(useLibraryStore.getState().theme).toBe("dark");
  });

  it("switches from dark to light", () => {
    useLibraryStore.setState({ theme: "dark" });
    useLibraryStore.getState().toggleTheme();
    expect(useLibraryStore.getState().theme).toBe("light");
  });

  it("persists new theme to localStorage", () => {
    useLibraryStore.setState({ theme: "light" });
    useLibraryStore.getState().toggleTheme();
    expect(localStorage.getItem("my-library-theme")).toBe("dark");
  });
});

describe("exportBooks", () => {
  it("delegates to database.exportAllBooks and returns its result", async () => {
    vi.mocked(database.exportAllBooks).mockResolvedValueOnce("[]");
    const result = await useLibraryStore.getState().exportBooks();
    expect(result).toBe("[]");
    expect(database.exportAllBooks).toHaveBeenCalled();
  });
});

describe("importBooks", () => {
  it("calls database.importBooks, reloads state, and returns count", async () => {
    vi.mocked(database.importBooks).mockResolvedValueOnce(3);
    vi.mocked(database.getAllBooks).mockResolvedValueOnce([]);

    const count = await useLibraryStore.getState().importBooks("[]");
    expect(count).toBe(3);
    expect(database.importBooks).toHaveBeenCalledWith("[]");
    expect(database.getAllBooks).toHaveBeenCalled();
  });
});
