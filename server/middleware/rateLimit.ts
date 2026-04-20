import rateLimit from "express-rate-limit";
import type { Request } from "express";

// Tiered limits — generous global ceiling, tighter budgets for writes, scrapers
// (outbound is already 1 req/s per host), and OCR (CPU-heavy). Defense-in-depth:
// the server runs on the LAN today, but these prevent accidental loops and abuse
// the moment it's exposed.

const ONE_MINUTE = 60 * 1000;

const baseConfig = {
  windowMs: ONE_MINUTE,
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
};

const skipSafe = (req: Request) =>
  req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS";

// Applied at /api — a wide safety ceiling across all endpoints.
export const globalLimiter = rateLimit({
  ...baseConfig,
  limit: 300,
});

// Only counts unsafe methods so reads aren't penalised.
export const writeLimiter = rateLimit({
  ...baseConfig,
  limit: 60,
  skip: skipSafe,
});

// Third-party scrapers — cbdb/legie are outbound-rate-limited at 1 req/s per host,
// so 60/min is already the natural ceiling.
export const scraperLimiter = rateLimit({
  ...baseConfig,
  limit: 60,
});

// OCR is CPU-heavy (sharp + tesseract). Keep it low.
export const ocrLimiter = rateLimit({
  ...baseConfig,
  limit: 20,
});

// Client error reporting — shouldn't be a high-volume channel.
export const clientErrorLimiter = rateLimit({
  ...baseConfig,
  limit: 30,
});
