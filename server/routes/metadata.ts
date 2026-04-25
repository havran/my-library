import { Router } from "express";
import { getAllUserSettings } from "../db.js";
import { logger } from "../logger.js";
import { BUILTIN_PLUGINS, DEFAULT_ORDER, pluginsMeta } from "../services/plugins/index.js";
import {
  runByAuthor,
  runByISBN,
  runBySeries,
  runByText,
  runByTitle,
  runCoverSearch,
  runEditions,
} from "../services/plugins/runner.js";
import { cacheCoverUrl } from "../services/plugins/coverCache.js";
import type { BookSearchResult, PluginConfig } from "../services/plugins/types.js";

function loadPluginConfig(userId: string): PluginConfig {
  const settings = getAllUserSettings(userId);
  const raw = settings["plugins"] as { order?: string[]; disabled?: string[] } | undefined;
  return {
    order: Array.isArray(raw?.order) && raw!.order.length ? raw!.order : DEFAULT_ORDER,
    disabled: Array.isArray(raw?.disabled) ? raw!.disabled : [],
  };
}

async function rewriteBookCover(book: BookSearchResult): Promise<BookSearchResult> {
  if (!book.coverUrl) return book;
  const cached = await cacheCoverUrl(book.coverUrl);
  return { ...book, coverUrl: cached ?? "" };
}

async function rewriteCoverUrls(urls: string[]): Promise<string[]> {
  const rewritten = await Promise.all(urls.map((u) => cacheCoverUrl(u)));
  return rewritten.filter((u): u is string => typeof u === "string" && u.length > 0);
}

export const metadataRouter: Router = Router();

metadataRouter.get("/", async (req, res) => {
  const mode = String(req.query.mode ?? "").trim();
  const q = String(req.query.q ?? "").trim();
  const isbn = String(req.query.isbn ?? "").trim();
  const title = String(req.query.title ?? "").trim();
  const authorsParam = String(req.query.authors ?? "").trim();

  const cfg = loadPluginConfig(req.user!.sub);

  try {
    switch (mode) {
      case "isbn": {
        const value = isbn || q;
        if (!value) {
          res.status(400).json({ error: "isbn required" });
          return;
        }
        const { book, sources } = await runByISBN(value, BUILTIN_PLUGINS, cfg);
        if (!book) {
          res.json({ book: null, sources });
          return;
        }
        const rewritten = await rewriteBookCover(book);
        res.json({ book: rewritten, sources });
        return;
      }
      case "title": {
        if (!q) {
          res.status(400).json({ error: "q required" });
          return;
        }
        const { results, sources } = await runByTitle(q, BUILTIN_PLUGINS, cfg);
        const rewritten = await Promise.all(results.map(rewriteBookCover));
        res.json({ results: rewritten, sources });
        return;
      }
      case "author": {
        if (!q) {
          res.status(400).json({ error: "q required" });
          return;
        }
        const { results, sources } = await runByAuthor(q, BUILTIN_PLUGINS, cfg);
        const rewritten = await Promise.all(results.map(rewriteBookCover));
        res.json({ results: rewritten, sources });
        return;
      }
      case "series": {
        if (!q) {
          res.status(400).json({ error: "q required" });
          return;
        }
        const { results, sources } = await runBySeries(q, BUILTIN_PLUGINS, cfg);
        const rewritten = await Promise.all(results.map(rewriteBookCover));
        res.json({ results: rewritten, sources });
        return;
      }
      case "text": {
        if (!q) {
          res.status(400).json({ error: "q required" });
          return;
        }
        const { results, sources } = await runByText(q, BUILTIN_PLUGINS, cfg);
        const rewritten = await Promise.all(results.map(rewriteBookCover));
        res.json({ results: rewritten, sources });
        return;
      }
      case "editions": {
        if (!q) {
          res.status(400).json({ error: "q required" });
          return;
        }
        const { results, sources } = await runEditions(q, BUILTIN_PLUGINS, cfg);
        const rewritten = await Promise.all(results.map(rewriteBookCover));
        res.json({ results: rewritten, sources });
        return;
      }
      case "cover": {
        if (!isbn && !title) {
          res.status(400).json({ error: "isbn or title required" });
          return;
        }
        const authors = authorsParam
          ? authorsParam
              .split(",")
              .map((a) => a.trim())
              .filter(Boolean)
          : undefined;
        const { covers, sources } = await runCoverSearch(
          { isbn: isbn || undefined, title: title || undefined, authors },
          BUILTIN_PLUGINS,
          cfg,
        );
        const rewritten = await rewriteCoverUrls(covers);
        res.json({ covers: rewritten, sources });
        return;
      }
      default:
        res.status(400).json({ error: "unknown mode" });
        return;
    }
  } catch (err) {
    const msg = (err as Error)?.message ?? String(err);
    logger.warn({ mode, err: msg }, "metadata endpoint failed");
    res.status(500).json({ error: "metadata error" });
  }
});

export const pluginsRouter: Router = Router();

pluginsRouter.get("/", (_req, res) => {
  res.json({ plugins: pluginsMeta(), defaultOrder: DEFAULT_ORDER });
});
