import { describe, it, expect } from "vitest";
import {
  LEGIE_BASE,
  parseLegieBookPage,
  parseLegieSearchLinks,
  parseLegieEditions,
  parseLegieSeriesBooks,
} from "./legie";

describe("parseLegieBookPage", () => {
  const fullPage = (overrides: Partial<Record<string, string>> = {}) => {
    const title = overrides.title ?? `<h2 id="nazev_knihy">Duna</h2>`;
    const author = overrides.author ?? `<h3><a href="autor/1-frank-herbert">Frank Herbert</a></h3>`;
    const cover = overrides.cover ?? `<img id="hlavni_obalka" src="images/kniha/12345-duna.jpg"/>`;
    const genres =
      overrides.genres ?? `<a href="tagy/1-sci-fi">sci-fi</a><a href="tagy/2-klasika">klasika</a>`;
    const rating =
      overrides.rating ??
      `<span itemprop="ratingValue">86</span><span itemprop="ratingCount">1423</span>`;
    const series = overrides.series ?? `<a href="serie/156-duna">Duna</a> díl v sérii: 1`;
    const anotace =
      overrides.anotace ??
      `<div class="anotace"><p><strong>Anotace:</strong><br/>
Dlouhá anotace.</p></div>`;
    return [title, author, cover, genres, rating, series, anotace].join("\n");
  };

  it("returns null when title missing", () => {
    expect(parseLegieBookPage("<div/>", "u")).toBeNull();
  });

  it("parses title, authors, cover, genres, rating", () => {
    const b = parseLegieBookPage(fullPage(), `${LEGIE_BASE}/kniha/12345-duna`)!;
    expect(b.title).toBe("Duna");
    expect(b.authors).toEqual(["Frank Herbert"]);
    expect(b.coverUrl).toBe(`${LEGIE_BASE}/images/kniha/12345-duna.jpg`);
    expect(b.genres).toEqual(["sci-fi", "klasika"]);
    expect(b.averageRating).toBe(8.6);
    expect(b.ratingsCount).toBe(1423);
  });

  it("extracts series slug and number", () => {
    const b = parseLegieBookPage(fullPage(), "u")!;
    expect(b.serieSlug).toBe("serie/156-duna");
    expect(b.series).toBe("Duna");
    expect(b.seriesNumber).toBe("1");
  });

  it("strips HTML from Anotace", () => {
    const b = parseLegieBookPage(fullPage(), "u")!;
    expect(b.description).toBe("Dlouhá anotace.");
  });

  it("returns empty strings and null ratings when fields absent", () => {
    const minimal = `<h2 id="nazev_knihy">Pouze název</h2>`;
    const b = parseLegieBookPage(minimal, "u")!;
    expect(b.authors).toEqual([]);
    expect(b.coverUrl).toBe("");
    expect(b.genres).toEqual([]);
    expect(b.averageRating).toBeNull();
    expect(b.ratingsCount).toBeNull();
    expect(b.series).toBe("");
    expect(b.serieSlug).toBe("");
    expect(b.seriesNumber).toBe("");
    expect(b.description).toBe("");
  });
});

describe("parseLegieSearchLinks", () => {
  it("returns empty for no matches", () => {
    expect(parseLegieSearchLinks("<div/>")).toEqual([]);
  });

  it("extracts slugs and strips subpages/trailing slash", () => {
    const html =
      `<a href="kniha/1-duna">Duna</a>` +
      `<a href="kniha/1-duna/vydani">more</a>` +
      `<a href="kniha/2-mesiah/">Mesiáš</a>`;
    expect(parseLegieSearchLinks(html)).toEqual(["kniha/1-duna", "kniha/2-mesiah"]);
  });
});

describe("parseLegieEditions", () => {
  it("returns empty when no cover images", () => {
    expect(parseLegieEditions("<div/>")).toEqual([]);
  });

  it("pairs each cover with the nearest following ISBN-13", () => {
    const html =
      `<img src="images/kniha-small/1-first.jpg"/>` +
      `ISBN: 9788025712345 Nakladatel: <a>Argo</a> Rok: 2020 Jazyk: <a>čeština</a>` +
      `<img src="images/kniha-small/2-second.jpg"/>` +
      `ISBN: 9780441172719 Nakladatel: <a>Ace</a> Rok: 1990 Jazyk: <a>angličtina</a>`;
    const editions = parseLegieEditions(html);
    expect(editions).toHaveLength(2);
    expect(editions[0]).toMatchObject({
      coverUrl: `${LEGIE_BASE}/images/kniha-small/1-first.jpg`,
      isbn: "9788025712345",
      publisher: "Argo",
      year: "2020",
      language: "čeština",
    });
    expect(editions[1]).toMatchObject({
      coverUrl: `${LEGIE_BASE}/images/kniha-small/2-second.jpg`,
      isbn: "9780441172719",
      publisher: "Ace",
      year: "1990",
      language: "angličtina",
    });
  });

  it("de-duplicates identical cover URLs", () => {
    const html =
      `<img src="images/kniha-small/1-x.jpg"/>` +
      `ISBN: 9788025712345` +
      `<img src="images/kniha-small/1-x.jpg"/>`;
    const editions = parseLegieEditions(html);
    expect(editions).toHaveLength(1);
  });

  it("returns null ISBN when no ISBN-13 exists nearby", () => {
    const html = `<img src="images/kniha-small/1.jpg"/>`;
    expect(parseLegieEditions(html)[0].isbn).toBeNull();
  });
});

describe("parseLegieSeriesBooks", () => {
  it("returns empty when no book links", () => {
    expect(parseLegieSeriesBooks("<div/>")).toEqual([]);
  });

  it("extracts books in order with slug and title", () => {
    const html =
      `<a href="kniha/1-duna">Duna</a>` +
      `<a href="kniha/2-mesias-duny">Mesiáš Duny</a>` +
      `<a href="kniha/3-deti-duny/">Děti Duny</a>`;
    expect(parseLegieSeriesBooks(html)).toEqual([
      { slug: "kniha/1-duna", title: "Duna", order: 1 },
      { slug: "kniha/2-mesias-duny", title: "Mesiáš Duny", order: 2 },
      { slug: "kniha/3-deti-duny", title: "Děti Duny", order: 3 },
    ]);
  });

  it("de-duplicates by slug", () => {
    const html =
      `<a href="kniha/1-duna">Duna</a>` + `<a href="kniha/1-duna">Duna (další odkaz)</a>`;
    const books = parseLegieSeriesBooks(html);
    expect(books).toHaveLength(1);
  });
});
