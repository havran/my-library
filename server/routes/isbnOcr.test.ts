import { describe, it, expect } from "vitest";
import { extractISBN } from "./isbnOcr";

describe("extractISBN", () => {
  it("returns both null when text is empty", () => {
    expect(extractISBN("")).toEqual({ isbn: null, partial: null });
  });

  it("extracts a full ISBN-13 starting with 978", () => {
    expect(extractISBN("junk 9780441172719 more")).toEqual({
      isbn: "9780441172719",
      partial: null,
    });
  });

  it("extracts a full ISBN-13 starting with 979", () => {
    expect(extractISBN("9791234567890")).toEqual({ isbn: "9791234567890", partial: null });
  });

  it("strips non-digits before matching", () => {
    expect(extractISBN("ISBN 978-0-441-17271-9").isbn).toBe("9780441172719");
  });

  it("returns partial when digits start with 978 but are incomplete", () => {
    expect(extractISBN("978044117")).toEqual({ isbn: null, partial: "978044117" });
  });

  it("discards partial shorter than 6 digits", () => {
    expect(extractISBN("97804")).toEqual({ isbn: null, partial: null });
  });

  it("returns null isbn and null partial for unrelated digits", () => {
    expect(extractISBN("12345 67890")).toEqual({ isbn: null, partial: null });
  });

  it("extracts a valid ISBN-10 (Czech old-book style)", () => {
    // 80-7218-373-7 → checksum digit recalculated to pure numeric form would need X for real books,
    // so we use a known-valid 10-digit ISBN that checksums cleanly.
    expect(extractISBN("ISBN 0-306-40615-2").isbn).toBe("0306406152");
  });

  it("extracts ISBN-10 embedded in noisy OCR text", () => {
    expect(extractISBN("blob 0306406152 noise").isbn).toBe("0306406152");
  });

  it("rejects a 10-digit run that fails the ISBN-10 checksum", () => {
    // 0306406153 differs by 1 from a valid ISBN-10 — should not be accepted
    expect(extractISBN("0306406153").isbn).toBeNull();
  });

  it("prefers ISBN-13 over a coincidental ISBN-10 window inside it", () => {
    expect(extractISBN("9780441172719").isbn).toBe("9780441172719");
  });
});
