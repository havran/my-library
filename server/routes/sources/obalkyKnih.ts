import { Router } from "express";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";

export const obalkyKnihRouter: Router = Router();

const UPSTREAM = "https://www.obalkyknih.cz/api/books";

obalkyKnihRouter.get("/", async (req, res) => {
  const isbn = typeof req.query.isbn === "string" ? req.query.isbn : "";
  if (!isbn) {
    res.status(400).json({ error: "isbn required" });
    return;
  }
  const params = new URLSearchParams({
    isbn,
    keywords: typeof req.query.keywords === "string" ? req.query.keywords : "",
  });
  try {
    const r = await rateLimitedFetch(`${UPSTREAM}?${params.toString()}`);
    const ct = r.headers.get("content-type");
    if (ct) res.type(ct);
    res.status(r.status).send(await r.text());
  } catch (err) {
    logger.warn({ source: "obalky-knih", err: (err as Error).message }, "upstream failed");
    res.status(502).json({ error: "upstream unavailable" });
  }
});
