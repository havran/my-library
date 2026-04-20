import { Router } from "express";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";

export const LEGIE_BASE = "https://www.legie.info";

const LEGIE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "cs-CZ,cs;q=0.9",
};

export interface LegieBook {
  title: string;
  authors: string[];
  coverUrl: string;
  genres: string[];
  averageRating: number | null;
  ratingsCount: number | null;
  series: string;
  serieSlug: string;
  seriesNumber: string;
  description: string;
  legieUrl: string;
}

export interface LegieEdition {
  coverUrl: string;
  isbn: string | null;
  publisher: string;
  year: string;
  language: string;
}

export function parseLegieBookPage(html: string, baseUrl: string): LegieBook | null {
  const title = html.match(/id="nazev_knihy"[^>]*>([^<]+)<\/h2>/)?.[1]?.trim();
  if (!title) return null;

  const authors = [...html.matchAll(/<h3[^>]*><a href="autor\/[^"]*">([^<]+)<\/a><\/h3>/g)]
    .map((m) => m[1].replace(/,\s*$/, "").trim())
    .filter(Boolean);

  const coverMatch = html.match(/id="hlavni_obalka"[^>]*src="([^"]+)"/);
  const coverUrl = coverMatch ? `${LEGIE_BASE}/${coverMatch[1]}` : "";

  const genres = [...html.matchAll(/href="tagy\/[^"]*">([^<]+)<\/a>/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);

  const ratingValue = html.match(/itemprop="ratingValue">(\d+)</)?.[1];
  const ratingCount = html.match(/itemprop="ratingCount">(\d+)</)?.[1];
  const averageRating = ratingValue ? parseFloat((parseInt(ratingValue) / 10).toFixed(1)) : null;
  const ratingsCount = ratingCount ? parseInt(ratingCount) : null;

  const seriesHrefMatch = html.match(/href="(serie\/[^"#]*)">([^<]+)<\/a>/);
  const serieSlug = seriesHrefMatch?.[1] ?? "";
  const series = seriesHrefMatch?.[2]?.trim() ?? "";
  const seriesNumberMatch = html.match(/díl v sérii:\s*(\d+)/);
  const seriesNumber = seriesNumberMatch?.[1] ?? "";

  const descMatch = html.match(
    /class="anotace"[^>]*>[\s\S]*?<p[^>]*><strong>Anotace:<\/strong><br[^>]*>\s*([\s\S]*?)<\/p>/,
  );
  const description = descMatch
    ? descMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/\n/g, " ")
        .trim()
    : "";

  return {
    title,
    authors,
    coverUrl,
    genres,
    averageRating,
    ratingsCount,
    series,
    serieSlug,
    seriesNumber,
    description,
    legieUrl: baseUrl,
  };
}

export function parseLegieSearchLinks(html: string): string[] {
  const links: string[] = [];
  // Capture slug only up to the first / (stops before /vydani, /zakladni-info)
  const re = /href="(kniha\/\d+[^/#"]+)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1].replace(/\/$/, "");
    if (!links.includes(href)) links.push(href);
  }
  return links;
}

export function parseLegieEditions(html: string): LegieEdition[] {
  const coverRe = /src="(images\/kniha-small\/[^"]+\.jpg)"/g;
  const covers: Array<{ url: string; pos: number }> = [];
  let m: RegExpExecArray | null;
  const seenUrls = new Set<string>();
  while ((m = coverRe.exec(html)) !== null) {
    const url = `${LEGIE_BASE}/${m[1]}`;
    if (!seenUrls.has(url)) {
      seenUrls.add(url);
      covers.push({ url, pos: m.index });
    }
  }

  const isbnRe = /97[89]\d{10}/g;
  const isbns: Array<{ isbn: string; pos: number }> = [];
  while ((m = isbnRe.exec(html)) !== null) isbns.push({ isbn: m[0], pos: m.index });

  return covers.map(({ url, pos }) => {
    // Prefer ISBN up to 3000 chars after the cover; penalise "before" by 500
    let bestIsbn: string | null = null;
    let bestDist = Infinity;
    for (const entry of isbns) {
      const dist = entry.pos >= pos ? entry.pos - pos : pos - entry.pos + 500;
      if (dist < bestDist && dist < 3000) {
        bestDist = dist;
        bestIsbn = entry.isbn;
      }
    }

    const window = html.slice(pos, pos + 2000);
    const publisherMatch =
      window.match(/Nakladatel(?:ství)?[^:]*:\s*<[^>]+>([^<]+)</) ??
      window.match(/Nakladatel(?:ství)?[^:]*:\s*([^\n<]{2,60})/);
    const publisher = publisherMatch?.[1]?.trim() ?? "";
    const yearMatch = window.match(/Rok[^:]*:\s*(\d{4})/);
    const year = yearMatch?.[1] ?? "";
    const langMatch =
      window.match(/Jazyk[^:]*:\s*<[^>]+>([^<]+)</) ?? window.match(/Jazyk[^:]*:\s*([^\n<]{2,40})/);
    const language = langMatch?.[1]?.trim() ?? "";

    return { coverUrl: url, isbn: bestIsbn, publisher, year, language };
  });
}

export function parseLegieSeriesBooks(
  html: string,
): Array<{ slug: string; title: string; order: number }> {
  const books: Array<{ slug: string; title: string; order: number }> = [];
  const seen = new Set<string>();
  const re = /href="(kniha\/\d+[^"#]*)"[^>]*>([^<]+)<\/a>/g;
  let m;
  let order = 1;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].replace(/\/$/, "");
    const title = m[2].trim();
    if (title && !seen.has(slug)) {
      seen.add(slug);
      books.push({ slug, title, order: order++ });
    }
  }
  return books;
}

export const legieRouter: Router = Router();

legieRouter.get("/serie", async (req, res) => {
  const slug = String(req.query.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  try {
    const serieRes = await rateLimitedFetch(`${LEGIE_BASE}/${slug}`, {
      headers: LEGIE_HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    const html = await serieRes.text();

    const titleMatch = html.match(/id="nazev_serie"[^>]*>([^<]+)<\/h2>/);
    const seriesTitle = titleMatch?.[1]?.trim() ?? "";

    const books = parseLegieSeriesBooks(html);
    res.json({ title: seriesTitle, books });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "legie error";
    logger.warn({ source: "legie", endpoint: "serie", slug, err: msg }, "legie serie proxy error");
    res.status(504).json({ error: "legie timeout or error" });
  }
});

legieRouter.get("/", async (req, res) => {
  const title = String(req.query.title ?? "").trim();
  const isbn = String(req.query.isbn ?? "").trim();
  const slug = String(req.query.slug ?? "").trim();
  if (!title && !isbn && !slug) {
    res.status(400).json({ error: "title, isbn, or slug required" });
    return;
  }

  try {
    let bookSlug: string;

    if (slug) {
      bookSlug = slug.replace(/\/$/, "");
    } else {
      const query = title || isbn;
      const searchRes = await rateLimitedFetch(
        `${LEGIE_BASE}/index.php?search_text=${encodeURIComponent(query)}`,
        { headers: LEGIE_HEADERS, signal: AbortSignal.timeout(8000) },
      );
      const searchHtml = await searchRes.text();
      const finalUrl = searchRes.url;

      bookSlug = finalUrl.includes("/kniha/")
        ? finalUrl.replace(LEGIE_BASE + "/", "").replace(/\/.*$/, "")
        : parseLegieSearchLinks(searchHtml)[0];

      if (!bookSlug) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      bookSlug = bookSlug.replace(/\/$/, "");
    }

    // Fetch metadata + edition covers sequentially (1 s rate limit per request)
    const infoRes = await rateLimitedFetch(`${LEGIE_BASE}/${bookSlug}/zakladni-info`, {
      headers: LEGIE_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const infoHtml = await infoRes.text();

    const vydaniRes = await rateLimitedFetch(`${LEGIE_BASE}/${bookSlug}/vydani`, {
      headers: LEGIE_HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    const vydaniHtml = await vydaniRes.text();

    const book = parseLegieBookPage(infoHtml, `${LEGIE_BASE}/${bookSlug}`);
    if (!book) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const editions = parseLegieEditions(vydaniHtml);
    const coverUrls = editions.map((e) => e.coverUrl);
    res.json({ ...book, editions, coverUrls });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "legie error";
    logger.warn(
      { source: "legie", endpoint: "book", title, isbn, slug, err: msg },
      "legie proxy error",
    );
    res.status(504).json({ error: "legie timeout or error" });
  }
});
