import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchByISBN, searchByTitle, searchByText } from "./bookApi";

const mockBook = {
  isbn: "9780261102217",
  title: "The Hobbit",
  authors: ["J.R.R. Tolkien"],
  genres: ["Fantasy"],
  description: "A hobbit's adventure",
  publisher: "Allen & Unwin",
  pageCount: 310,
  coverUrl: "/api/covers/abc.jpg",
  averageRating: 4.5,
  ratingsCount: 1000,
};

describe("fetchByISBN", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns book from /api/metadata response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ book: mockBook, sources: [] }),
    } as Response);

    const result = await fetchByISBN("9780261102217");
    expect(result?.title).toBe("The Hobbit");
    expect(result?.isbn).toBe("9780261102217");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/metadata?mode=isbn&q=9780261102217");
  });

  it("returns null when server reports no match", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ book: null, sources: [] }),
    } as Response);
    expect(await fetchByISBN("0000000000000")).toBeNull();
  });

  it("returns null on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    expect(await fetchByISBN("0000000000000")).toBeNull();
  });
});

describe("searchByTitle", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns results from /api/metadata", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ results: [mockBook], sources: [] }),
    } as Response);

    const results = await searchByTitle("hobbit");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("The Hobbit");
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe("/api/metadata?mode=title&q=hobbit");
  });

  it("returns empty array on fetch failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await searchByTitle("anything")).toEqual([]);
  });
});

describe("searchByText", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns multiple results on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ results: [mockBook, { ...mockBook, isbn: "0123456789" }], sources: [] }),
    } as Response);
    const results = await searchByText("tolkien");
    expect(results).toHaveLength(2);
  });

  it("returns empty array on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await searchByText("query")).toEqual([]);
  });
});
