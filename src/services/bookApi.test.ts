import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchByISBN, searchByTitle, searchByText, parseGoogleBook } from "./bookApi";
import { registerBuiltinPlugins, usePluginConfig } from "./plugins";

// Register built-in plugins once for the whole suite
registerBuiltinPlugins();

const mockGoogleItem = {
  volumeInfo: {
    title: "The Hobbit",
    authors: ["J.R.R. Tolkien"],
    categories: ["Fantasy"],
    description: "A hobbit's adventure",
    publisher: "Allen & Unwin",
    pageCount: 310,
    averageRating: 4.5,
    ratingsCount: 1000,
    industryIdentifiers: [
      { type: "ISBN_13", identifier: "9780261102217" },
      { type: "ISBN_10", identifier: "0261102214" },
    ],
    imageLinks: {
      thumbnail: "http://books.google.com/thumbnail?id=abc&zoom=1&edge=curl",
    },
  },
};

describe("parseGoogleBook", () => {
  it("parses title, authors, genres, publisher, pageCount", () => {
    const r = parseGoogleBook(mockGoogleItem);
    expect(r.title).toBe("The Hobbit");
    expect(r.authors).toEqual(["J.R.R. Tolkien"]);
    expect(r.genres).toEqual(["Fantasy"]);
    expect(r.publisher).toBe("Allen & Unwin");
    expect(r.pageCount).toBe(310);
    expect(r.averageRating).toBe(4.5);
    expect(r.ratingsCount).toBe(1000);
  });

  it("prefers ISBN_13 over ISBN_10", () => {
    expect(parseGoogleBook(mockGoogleItem).isbn).toBe("9780261102217");
  });

  it("falls back to ISBN_10 when ISBN_13 is missing", () => {
    const item = {
      volumeInfo: {
        ...mockGoogleItem.volumeInfo,
        industryIdentifiers: [{ type: "ISBN_10", identifier: "0261102214" }],
      },
    };
    expect(parseGoogleBook(item).isbn).toBe("0261102214");
  });

  it("returns null isbn when no identifiers present", () => {
    const item = { volumeInfo: { ...mockGoogleItem.volumeInfo, industryIdentifiers: [] } };
    expect(parseGoogleBook(item).isbn).toBeNull();
  });

  it("upgrades thumbnail from http to https and zoom=1 to zoom=2", () => {
    const r = parseGoogleBook(mockGoogleItem);
    expect(r.coverUrl).toContain("https:");
    expect(r.coverUrl).not.toContain("http:");
    expect(r.coverUrl).toContain("zoom=2");
  });

  it("returns empty coverUrl when imageLinks is missing", () => {
    const item = { volumeInfo: { ...mockGoogleItem.volumeInfo, imageLinks: undefined } };
    expect(parseGoogleBook(item).coverUrl).toBe("");
  });

  it("uses Unknown Title when title is missing", () => {
    expect(parseGoogleBook({ volumeInfo: {} }).title).toBe("Unknown Title");
  });

  it("returns empty arrays for missing authors and categories", () => {
    const r = parseGoogleBook({ volumeInfo: {} });
    expect(r.authors).toEqual([]);
    expect(r.genres).toEqual([]);
  });
});

/** Leave only Google Books enabled so tests don't depend on 4+ parallel calls. */
function onlyGoogleBooks() {
  usePluginConfig.setState({
    order: ["google-books", "open-library", "nkp-aleph", "cbdb", "legie", "obalky-knih"],
    disabled: ["open-library", "nkp-aleph", "cbdb", "legie", "obalky-knih"],
  });
}

describe("fetchByISBN (via plugin runner)", () => {
  beforeEach(() => {
    onlyGoogleBooks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed book when Google Books finds a match", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ totalItems: 1, items: [mockGoogleItem] }),
    } as Response);

    const result = await fetchByISBN("9780261102217");
    expect(result?.title).toBe("The Hobbit");
    expect(result?.isbn).toBe("9780261102217");
  });

  it("returns null when the only enabled source returns nothing", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ totalItems: 0 }),
    } as Response);
    expect(await fetchByISBN("0000000000000")).toBeNull();
  });

  it("returns null when all sources throw", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    expect(await fetchByISBN("0000000000000")).toBeNull();
  });
});

describe("searchByTitle", () => {
  beforeEach(() => {
    onlyGoogleBooks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed books on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [mockGoogleItem] }),
    } as Response);

    const results = await searchByTitle("hobbit");
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("The Hobbit");
  });

  it("returns empty array when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await searchByTitle("anything")).toEqual([]);
  });
});

describe("searchByText", () => {
  beforeEach(() => {
    onlyGoogleBooks();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("returns multiple parsed books on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [mockGoogleItem, mockGoogleItem] }),
    } as Response);

    const results = await searchByText("tolkien fantasy");
    // Dedupe by ISBN — two identical items collapse to one
    expect(results).toHaveLength(1);
  });

  it("returns empty array on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await searchByText("query")).toEqual([]);
  });
});
