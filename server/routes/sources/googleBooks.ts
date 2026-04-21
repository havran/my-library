import { Router } from "express";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";

export const googleBooksRouter: Router = Router();

const UPSTREAM = "https://www.googleapis.com/books/v1/volumes";

googleBooksRouter.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const max = typeof req.query.maxResults === "string" ? req.query.maxResults : "10";
  if (!q) {
    res.status(400).json({ error: "q required" });
    return;
  }
  const params = new URLSearchParams({ q, maxResults: max });
  try {
    const r = await rateLimitedFetch(`${UPSTREAM}?${params.toString()}`);
    const ct = r.headers.get("content-type");
    if (ct) res.type(ct);
    res.status(r.status).send(await r.text());
  } catch (err) {
    logger.warn({ source: "google-books", err: (err as Error).message }, "upstream failed");
    res.status(502).json({ error: "upstream unavailable" });
  }
});
