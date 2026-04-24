import { Router } from "express";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";
import {
  LEGIE_BASE,
  LEGIE_HEADERS,
  parseLegieBookPage,
  parseLegieEditions,
  parseLegieSearchLinks,
  parseLegieSeriesBooks,
} from "../../services/plugins/sources/legie.js";

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
