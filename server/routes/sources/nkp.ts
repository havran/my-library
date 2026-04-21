import { Router } from "express";
import { rateLimitedFetch } from "../../http.js";
import { logger } from "../../logger.js";

export const nkpRouter: Router = Router();

const UPSTREAM = "https://aleph.nkp.cz/X";

// Aleph X-Server supports a two-step lookup (op=find then op=present). Pass
// through only the params the NKP plugin sends — keeps the proxy from being a
// general-purpose redirector.
const ALLOWED = new Set(["op", "request", "base", "set_number", "set_entry", "format"]);

nkpRouter.get("/", async (req, res) => {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (!ALLOWED.has(k)) continue;
    if (typeof v === "string") params.set(k, v);
  }
  if (!params.has("op")) {
    res.status(400).json({ error: "op required" });
    return;
  }
  try {
    const r = await rateLimitedFetch(`${UPSTREAM}?${params.toString()}`);
    const ct = r.headers.get("content-type") ?? "text/xml; charset=utf-8";
    res.type(ct);
    res.status(r.status).send(await r.text());
  } catch (err) {
    logger.warn({ source: "nkp", err: (err as Error).message }, "upstream failed");
    res.status(502).json({ error: "upstream unavailable" });
  }
});
