import { describe, it, expect } from "vitest";
import {
  parseDatabazeknihBookPage,
  parseDatabazeknihSearchLinks,
  parseDbkEditionLanguageSlugs,
  parseDbkEditions,
} from "./databazeknih.js";

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

describe("parseDbkEditionLanguageSlugs", () => {
  it("collects unique language codes from tab links", () => {
    const html = `
      <div class="tab now"><a href='/dalsi-vydani/foo-1?lang=cz'></a></div>
      <div class="tab"><a href='/dalsi-vydani/foo-1?lang=sk'></a></div>
      <a href="/dalsi-vydani/foo-1?lang=cz">dup</a>
    `;
    expect(parseDbkEditionLanguageSlugs(html).sort()).toEqual(["cz", "sk"]);
  });
});

describe("parseDbkEditions", () => {
  const item = (id: string, title: string, year: string, publisher: string, isbn: string) => `
    <a href="/dalsi-vydani/${id}">
      <picture>
        <img src="https://cdn/img-${id}.jpg" alt="Obálka knihy ${title} (${year})" />
      </picture>
    </a>
    <h6>${title}</h6>
    <p class='new odtopm'>
      ${year}<span class="pozn_light">,</span>
      <a href="/nakladatelstvi/${publisher}-99">${publisher}</a>
      <span class="pozn odtopm fright">ISBN: ${isbn}</span>
    </p>
    <hr class='oddown' />
  `;

  it("parses cover/title/year/publisher/isbn for each edition", () => {
    const html = `<a name='editions'></a>${item("a-1", "Lovci Duny", "2023", "Baronet", "978-80-269-2005-2")}${item("b-2", "Lovci Duny", "2007", "Baronet", "80-7384-000-6")}`;
    const eds = parseDbkEditions(html, "cz");
    expect(eds).toHaveLength(2);
    expect(eds[0]).toMatchObject({
      title: "Lovci Duny",
      year: "2023",
      publisher: "Baronet",
      isbn: "9788026920052",
      language: "cz",
    });
    expect(eds[1]).toMatchObject({ year: "2007", isbn: "8073840006" });
  });

  it("skips chunks without a cover image", () => {
    const html = `<a name='editions'></a><a href="/dalsi-vydani/no-cover-1">no img</a><hr class='oddown' />`;
    expect(parseDbkEditions(html)).toHaveLength(0);
  });
});
