import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchByISBN, searchByTitle, searchByText, parseGoogleBook } from "./bookApi";

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

  it("upgrades thumbnail from http to https", () => {
    const r = parseGoogleBook(mockGoogleItem);
    expect(r.coverUrl).toContain("https:");
    expect(r.coverUrl).not.toContain("http:");
  });

  it("upgrades thumbnail zoom=1 to zoom=2", () => {
    const r = parseGoogleBook(mockGoogleItem);
    expect(r.coverUrl).toContain("zoom=2");
    expect(r.coverUrl).not.toContain("zoom=1");
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

describe("fetchByISBN", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed book when Google Books finds a match", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ totalItems: 1, items: [mockGoogleItem] }),
    } as Response);

    const result = await fetchByISBN("9780261102217");
    expect(result?.title).toBe("The Hobbit");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("falls through to Open Library when Google Books has no items", async () => {
    const olResponse = {
      "ISBN:9780261102217": {
        title: "The Hobbit (OL)",
        authors: [{ name: "J.R.R. Tolkien" }],
        subjects: [{ name: "Fantasy" }],
        cover: { large: "https://covers.openlibrary.org/b/id/123-L.jpg" },
        number_of_pages: 310,
        publishers: [{ name: "Allen & Unwin" }],
      },
    };

    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: async () => ({ totalItems: 0 }) } as Response)
      .mockResolvedValueOnce({ json: async () => olResponse } as Response);

    const result = await fetchByISBN("9780261102217");
    expect(result?.title).toBe("The Hobbit (OL)");
    expect(result?.coverUrl).toBe("https://covers.openlibrary.org/b/id/123-L.jpg");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("falls through to NKP when Google Books and Open Library fail", async () => {
    const nkpFindXml = `<find><no_records>1</no_records><set_number>1</set_number></find>`;
    const nkpPresentXml = `
      <present>
        <record>
          <varfield id="245">
            <subfield label="a">Válka světů</subfield>
          </varfield>
          <varfield id="100">
            <subfield label="a">Wells, Herbert George</subfield>
          </varfield>
          <varfield id="020">
            <subfield label="a">9788090404922</subfield>
          </varfield>
          <varfield id="300">
            <subfield label="a">215 stran</subfield>
          </varfield>
          <varfield id="650">
            <subfield label="a">science fiction</subfield>
          </varfield>
        </record>
      </present>`;

    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: async () => ({ totalItems: 0 }) } as Response)
      .mockResolvedValueOnce({ json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ text: async () => nkpFindXml } as Response)
      .mockResolvedValueOnce({ text: async () => nkpPresentXml } as Response);

    const result = await fetchByISBN("9788090404922");
    expect(result?.title).toBe("Válka světů");
    expect(result?.authors).toContain("Wells, Herbert George");
    expect(result?.pageCount).toBe(215);
    expect(result?.coverUrl).toBe("");
    expect(result?.genres).toContain("science fiction");
  });

  it("returns null when NKP finds no records", async () => {
    const nkpNoRecords = `<find><no_records>0</no_records></find>`;

    vi.mocked(fetch)
      .mockResolvedValueOnce({ json: async () => ({ totalItems: 0 }) } as Response)
      .mockResolvedValueOnce({ json: async () => ({}) } as Response)
      .mockResolvedValueOnce({ text: async () => nkpNoRecords } as Response);

    const result = await fetchByISBN("0000000000000");
    expect(result).toBeNull();
  });

  it("returns null when all sources throw", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    expect(await fetchByISBN("0000000000000")).toBeNull();
  });
});

describe("searchByTitle", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns parsed books on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
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

  it("returns empty array when items is undefined", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ totalItems: 0 }),
    } as Response);
    expect(await searchByTitle("nothing")).toEqual([]);
  });
});

describe("searchByText", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it("returns multiple parsed books on success", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      json: async () => ({ items: [mockGoogleItem, mockGoogleItem] }),
    } as Response);

    const results = await searchByText("tolkien fantasy");
    expect(results).toHaveLength(2);
  });

  it("returns empty array on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("offline"));
    expect(await searchByText("query")).toEqual([]);
  });
});
