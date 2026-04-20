import { describe, it, expect } from "vitest";
import { mergeResults } from "./runner";
import type { BookSearchResult } from "@/types/book";

function r(partial: Partial<BookSearchResult>): BookSearchResult {
  return {
    isbn: null,
    title: "",
    authors: [],
    genres: [],
    description: "",
    publisher: "",
    pageCount: null,
    coverUrl: "",
    averageRating: null,
    ratingsCount: null,
    ...partial,
  };
}

describe("mergeResults", () => {
  it("returns null when no candidates have data", () => {
    expect(mergeResults([null, null])).toBeNull();
  });

  it("takes each field from the first candidate with a non-empty value", () => {
    const a = r({ title: "A", authors: [], coverUrl: "" });
    const b = r({ title: "B", authors: ["X"], coverUrl: "cover.jpg" });
    const merged = mergeResults([a, b]);
    expect(merged?.title).toBe("A");
    expect(merged?.authors).toEqual(["X"]);
    expect(merged?.coverUrl).toBe("cover.jpg");
  });

  it("treats empty string and empty array as missing", () => {
    const a = r({ description: "", genres: [] });
    const b = r({ description: "fallback", genres: ["Sci-Fi"] });
    const merged = mergeResults([a, b]);
    expect(merged?.description).toBe("fallback");
    expect(merged?.genres).toEqual(["Sci-Fi"]);
  });

  it("respects candidate order for priority", () => {
    const hi = r({ title: "High", coverUrl: "hi.jpg" });
    const lo = r({ title: "Low", coverUrl: "lo.jpg" });
    expect(mergeResults([hi, lo])?.coverUrl).toBe("hi.jpg");
    expect(mergeResults([lo, hi])?.coverUrl).toBe("lo.jpg");
  });

  it("defaults missing required fields to safe values", () => {
    const merged = mergeResults([r({ title: "Only Title" })]);
    expect(merged?.authors).toEqual([]);
    expect(merged?.pageCount).toBeNull();
    expect(merged?.coverUrl).toBe("");
  });

  it("supports enrichment-style merging across fields", () => {
    // ISBN source provides bibliographic data; enricher adds rating + series
    const bibliographic = r({
      isbn: "123",
      title: "Dune",
      authors: ["Herbert"],
      publisher: "Chilton",
      pageCount: 412,
    });
    const enricher = r({
      title: "Dune",
      coverUrl: "legie.jpg",
      averageRating: 4.8,
      series: "Dune",
      seriesNumber: "1",
    });
    const merged = mergeResults([bibliographic, enricher]);
    expect(merged?.isbn).toBe("123");
    expect(merged?.publisher).toBe("Chilton");
    expect(merged?.pageCount).toBe(412);
    expect(merged?.coverUrl).toBe("legie.jpg");
    expect(merged?.averageRating).toBe(4.8);
    expect(merged?.series).toBe("Dune");
  });
});
