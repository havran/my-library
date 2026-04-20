import { describe, it, expect } from "vitest";
import { parseCbdbBookPage, parseCbdbSearchLinks } from "./cbdb";

describe("parseCbdbBookPage", () => {
  const jsonLd = (obj: object) =>
    `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

  it("returns null when JSON-LD is missing", () => {
    expect(parseCbdbBookPage("<html>no ld</html>")).toBeNull();
  });

  it("returns null when JSON-LD is malformed", () => {
    expect(parseCbdbBookPage(`<script type="application/ld+json">{not json</script>`)).toBeNull();
  });

  it("returns null when name is missing", () => {
    expect(parseCbdbBookPage(jsonLd({ author: [] }))).toBeNull();
  });

  it("extracts core fields from JSON-LD", () => {
    const html = jsonLd({
      name: "Duna",
      image: "https://cbdb.cz/cover.jpg",
      description: "Klasika sci-fi",
      author: [{ name: "Frank Herbert" }, { name: "" }],
      aggregateRating: { ratingValue: "85", ratingCount: "1200" },
    });
    const b = parseCbdbBookPage(html)!;
    expect(b.title).toBe("Duna");
    expect(b.coverUrl).toBe("https://cbdb.cz/cover.jpg");
    expect(b.description).toBe("Klasika sci-fi");
    expect(b.authors).toEqual(["Frank Herbert"]);
    expect(b.averageRating).toBe(85);
    expect(b.ratingsCount).toBe(1200);
  });

  it("falls back to thumbnailUrl when image missing", () => {
    const html = jsonLd({ name: "X", thumbnailUrl: "https://cbdb.cz/thumb.jpg" });
    expect(parseCbdbBookPage(html)!.coverUrl).toBe("https://cbdb.cz/thumb.jpg");
  });

  it("extracts publisher, pages, ISBN from gray_box markup", () => {
    const html =
      jsonLd({ name: "T" }) +
      `<b>Nakladatelství (rok):</b> <a href="/n/1">Argo</a>` +
      `<b>Stran:</b> 512 ` +
      `<b>ISBN:</b> 978-80-257-1234-5 `;
    const b = parseCbdbBookPage(html)!;
    expect(b.publisher).toBe("Argo");
    expect(b.pageCount).toBe(512);
    expect(b.isbn).toBe("9788025712345");
  });

  it("collects genres from genre_label anchors", () => {
    const html =
      jsonLd({ name: "T" }) +
      `<a class="genre_label" href="/g/1">Sci-fi</a>` +
      `<a class="genre_label" href="/g/2">Fantasy</a>`;
    expect(parseCbdbBookPage(html)!.genres).toEqual(["Sci-fi", "Fantasy"]);
  });

  it("returns null rating fields when aggregateRating absent", () => {
    const b = parseCbdbBookPage(jsonLd({ name: "T" }))!;
    expect(b.averageRating).toBeNull();
    expect(b.ratingsCount).toBeNull();
  });
});

describe("parseCbdbSearchLinks", () => {
  it("returns empty when no links match", () => {
    expect(parseCbdbSearchLinks("<html/>")).toEqual([]);
  });

  it("picks up graphic box links first", () => {
    const html =
      `<a href="kniha-1-duna" class="search_graphic_box_img"><img/></a>` +
      `<a href="kniha-2-messiah" class="search_graphic_box_img"><img/></a>`;
    expect(parseCbdbSearchLinks(html)).toEqual(["kniha-1-duna", "kniha-2-messiah"]);
  });

  it("falls back to search_text links when no graphic links", () => {
    const html = `<a href="kniha-3-children" class="search_text1">Děti Duny</a>`;
    expect(parseCbdbSearchLinks(html)).toEqual(["kniha-3-children"]);
  });

  it("de-duplicates fallback links", () => {
    const html =
      `<a href="kniha-3-x" class="search_text1">A</a>` +
      `<a href="kniha-3-x" class="search_text2">A</a>`;
    expect(parseCbdbSearchLinks(html)).toEqual(["kniha-3-x"]);
  });
});
