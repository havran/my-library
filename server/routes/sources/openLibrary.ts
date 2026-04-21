import { Router } from "express";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";

export const openLibraryRouter: Router = Router();

const UPSTREAM = "https://openlibrary.org/api/books";

openLibraryRouter.get("/", async (req, res) => {
  const bibkeys = typeof req.query.bibkeys === "string" ? req.query.bibkeys : "";
  if (!bibkeys) {
    res.status(400).json({ error: "bibkeys required" });
    return;
  }
  const params = new URLSearchParams({
    bibkeys,
    format: typeof req.query.format === "string" ? req.query.format : "json",
    jscmd: typeof req.query.jscmd === "string" ? req.query.jscmd : "data",
  });
  try {
    const r = await rateLimitedFetch(`${UPSTREAM}?${params.toString()}`);
    const ct = r.headers.get("content-type");
    if (ct) res.type(ct);
    res.status(r.status).send(await r.text());
  } catch (err) {
    logger.warn({ source: "open-library", err: (err as Error).message }, "upstream failed");
    res.status(502).json({ error: "upstream unavailable" });
  }
});
