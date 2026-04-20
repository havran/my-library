import { describe, it, expect } from "vitest";
import {
  alternateISBN,
  isValidIsbn10,
  isValidIsbn13,
  isbn10To13,
  isbn13To10,
  normalizeISBN,
} from "./isbn";

describe("normalizeISBN", () => {
  it("strips hyphens/spaces and uppercases X", () => {
    expect(normalizeISBN("0-306-40615-x")).toBe("030640615X");
  });
});

describe("isValidIsbn10", () => {
  it("accepts a known-valid ISBN-10", () => {
    expect(isValidIsbn10("0306406152")).toBe(true);
  });
  it("accepts X as check digit", () => {
    expect(isValidIsbn10("030640615X")).toBe(false); // wrong check
    expect(isValidIsbn10("097522980X")).toBe(true);
  });
  it("rejects bad length or letters", () => {
    expect(isValidIsbn10("030640615")).toBe(false);
    expect(isValidIsbn10("abcdefghij")).toBe(false);
  });
});

describe("isValidIsbn13", () => {
  it("accepts a known-valid ISBN-13", () => {
    expect(isValidIsbn13("9780441172719")).toBe(true);
  });
  it("rejects wrong check digit", () => {
    expect(isValidIsbn13("9780441172710")).toBe(false);
  });
});

describe("isbn10To13", () => {
  it("converts a Czech-style ISBN-10 to the expected ISBN-13", () => {
    // 8085637928 → 9788085637922 (prepend 978, recompute check)
    expect(isbn10To13("8085637928")).toBe("9788085637922");
  });
  it("returns null for non-10-digit input", () => {
    expect(isbn10To13("12345")).toBe(null);
  });
  it("accepts hyphenated input", () => {
    expect(isbn10To13("0-306-40615-2")).toBe("9780306406157");
  });
});

describe("isbn13To10", () => {
  it("round-trips 978-prefixed ISBN-13 to its ISBN-10", () => {
    expect(isbn13To10("9788085637922")).toBe("8085637928");
    expect(isbn13To10("9780306406157")).toBe("0306406152");
  });
  it("returns null for 979-prefixed ISBN-13 (no ISBN-10 equivalent)", () => {
    expect(isbn13To10("9791234567890")).toBe(null);
  });
});

describe("alternateISBN", () => {
  it("gives ISBN-13 from ISBN-10", () => {
    expect(alternateISBN("8085637928")).toBe("9788085637922");
  });
  it("gives ISBN-10 from a 978 ISBN-13", () => {
    expect(alternateISBN("9788085637922")).toBe("8085637928");
  });
  it("returns null for unexpected lengths", () => {
    expect(alternateISBN("12345")).toBe(null);
  });
});
