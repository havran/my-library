import { describe, it, expect } from "vitest";
import { parseDatabazeknihBookPage, parseDatabazeknihSearchLinks } from "./databazeknih.js";

const jsonLd = (obj: object) =>
  `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe("parseDatabazeknihBookPage", () => {
  it("returns null when JSON-LD is missing", () => {
    expect(parseDatabazeknihBookPage("<html>no ld</html>")).toBeNull();
  });

  it("returns null when JSON-LD is malformed", () => {
    expect(
      parseDatabazeknihBookPage(`<script type="application/ld+json">{oops</script>`),
    ).toBeNull();
  });

  it("returns null when name is missing", () => {
    expect(parseDatabazeknihBookPage(jsonLd({ author: [] }))).toBeNull();
  });

  it("extracts core fields from JSON-LD", () => {
    const html = jsonLd({
      name: "Deepsix",
      isbn: "978-80-7174-680-5",
      image: "https://www.databazeknih.cz/img/bmid.jpg",
      description: "Druhá kniha série Motory boha.",
      author: [{ name: "Jack McDevitt" }, { name: "" }],
      publisher: [{ name: "Návrat" }],
      aggregateRating: { ratingValue: "4.2", ratingCount: 48 },
    });
    const b = parseDatabazeknihBookPage(html)!;
    expect(b.title).toBe("Deepsix");
    expect(b.isbn).toBe("9788071746805");
    expect(b.authors).toEqual(["Jack McDevitt"]);
    expect(b.publisher).toBe("Návrat");
    expect(b.coverUrl).toBe("https://www.databazeknih.cz/img/bmid.jpg");
    // Normalized from 4.2/5 → 84/100.
    expect(b.averageRating).toBe(84);
    expect(b.ratingsCount).toBe(48);
  });

  it("prefers DOM description over truncated JSON-LD one", () => {
    const html =
      jsonLd({ name: "T", description: "short preview..." }) +
      `<p class='new2 odtop'>First part of text <span class='end_text et_1'>and the rest of it.</span><a href='#' class='show_hide_more' bid='1'>... celý text</a></p>`;
    const b = parseDatabazeknihBookPage(html)!;
    expect(b.description).toBe("First part of text and the rest of it.");
  });

  it("collects genres from genre anchors", () => {
    const html =
      jsonLd({ name: "T" }) +
      `<a class="genre" href='/zanry/sci-fi-19'>Sci-fi</a>` +
      `<a class="genre" href='/zanry/romany-12'>Romány</a>`;
    expect(parseDatabazeknihBookPage(html)!.genres).toEqual(["Sci-fi", "Romány"]);
  });

  it("extracts series name and volume number", () => {
    const html =
      jsonLd({ name: "T" }) +
      `<a class="odright_pet" href='/serie/motory-boha-2195?lang=cz' title='Motory Boha'>Motory Boha</a> série` +
      `<span class="odright_pet odleft_pet">2. díl</span>`;
    const b = parseDatabazeknihBookPage(html)!;
    expect(b.series).toBe("Motory Boha");
    expect(b.seriesNumber).toBe("2");
  });

  it("returns null rating fields when aggregateRating absent", () => {
    const b = parseDatabazeknihBookPage(jsonLd({ name: "T" }))!;
    expect(b.averageRating).toBeNull();
    expect(b.ratingsCount).toBeNull();
  });

  it("returns null isbn when JSON-LD has none", () => {
    expect(parseDatabazeknihBookPage(jsonLd({ name: "T" }))!.isbn).toBeNull();
  });
});

describe("parseDatabazeknihSearchLinks", () => {
  it("returns empty when no links match", () => {
    expect(parseDatabazeknihSearchLinks("<html/>")).toEqual([]);
  });

  it("extracts prehled-knihy links in order", () => {
    const html =
      `<a href="/prehled-knihy/motory-boha-deepsix-23278">A</a>` +
      `<a href="/prehled-knihy/dirk-pitt-hrbitov-379299">B</a>`;
    expect(parseDatabazeknihSearchLinks(html)).toEqual([
      "/prehled-knihy/motory-boha-deepsix-23278",
      "/prehled-knihy/dirk-pitt-hrbitov-379299",
    ]);
  });

  it("de-duplicates repeated links", () => {
    const html = `<a href="/prehled-knihy/x-1">A</a>` + `<a href='/prehled-knihy/x-1'>A</a>`;
    expect(parseDatabazeknihSearchLinks(html)).toEqual(["/prehled-knihy/x-1"]);
  });
});
