import { alternateISBN } from "../../utils/isbn.js";
import { logger } from "../../logger.js";
import { pluginsFor, priorityIndex } from "./registry.js";
import type {
  BookSearchResult,
  BookSourcePlugin,
  CoverSearchContext,
  PluginConfig,
  PluginStatus,
} from "./types.js";

const DEFAULT_TIMEOUT = 8000;

export interface PluginCallReport {
  id: string;
  status: PluginStatus;
  ms: number;
  error?: string;
  /** For runByISBN: which attempt this report belongs to. Absent for non-ISBN modes. */
  attempt?: "primary" | "alt";
}

interface WrappedResult<T> {
  value: T | null;
  report: PluginCallReport;
}

async function withPluginTimeout<T>(
  p: BookSourcePlugin,
  call: (signal: AbortSignal) => Promise<T>,
  emptyCheck: (v: T | null) => boolean,
): Promise<WrappedResult<T>> {
  const ctrl = new AbortController();
  const timeoutMs = p.timeoutMs ?? DEFAULT_TIMEOUT;
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const v = await call(ctrl.signal);
    const ms = Date.now() - started;
    const status: PluginStatus = emptyCheck(v) ? "empty" : "ok";
    return { value: v, report: { id: p.id, status, ms } };
  } catch (err) {
    const ms = Date.now() - started;
    const msg = (err as Error)?.message ?? String(err);
    const status: PluginStatus = ctrl.signal.aborted ? "timeout" : "error";
    logger.debug({ plugin: p.id, status, err: msg, ms }, "plugin call failed");
    return { value: null, report: { id: p.id, status, ms, error: msg } };
  } finally {
    clearTimeout(timer);
  }
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

const MERGE_FIELDS: (keyof BookSearchResult)[] = [
  "isbn",
  "title",
  "authors",
  "genres",
  "description",
  "publisher",
  "pageCount",
  "coverUrl",
  "averageRating",
  "ratingsCount",
  "series",
  "seriesNumber",
  "serieSlug",
];

export function mergeResults(candidates: (BookSearchResult | null)[]): BookSearchResult | null {
  const valid = candidates.filter(Boolean) as BookSearchResult[];
  if (!valid.length) return null;
  const out: Record<string, unknown> = {};
  for (const f of MERGE_FIELDS) {
    for (const c of valid) {
      const v = (c as Record<string, unknown>)[f];
      if (!isEmpty(v)) {
        out[f] = v;
        break;
      }
    }
  }
  return {
    isbn: (out.isbn as string | null) ?? null,
    title: (out.title as string) || "Unknown Title",
    authors: (out.authors as string[]) ?? [],
    genres: (out.genres as string[]) ?? [],
    description: (out.description as string) ?? "",
    publisher: (out.publisher as string) ?? "",
    pageCount: (out.pageCount as number | null) ?? null,
    coverUrl: (out.coverUrl as string) ?? "",
    averageRating: (out.averageRating as number | null) ?? null,
    ratingsCount: (out.ratingsCount as number | null) ?? null,
    series: (out.series as string | undefined) ?? "",
    seriesNumber: (out.seriesNumber as string | undefined) ?? "",
    serieSlug: (out.serieSlug as string | undefined) ?? "",
  };
}

type Candidate = { pluginId: string; result: BookSearchResult | null };

function sortByPriority(cs: Candidate[], cfg: PluginConfig): Candidate[] {
  const idx = priorityIndex(cfg);
  return [...cs].sort((a, b) => {
    const ai = idx.get(a.pluginId) ?? Number.POSITIVE_INFINITY;
    const bi = idx.get(b.pluginId) ?? Number.POSITIVE_INFINITY;
    return ai - bi;
  });
}

export interface RunByIsbnResult {
  book: BookSearchResult | null;
  sources: PluginCallReport[];
}

async function runByIsbnOnce(
  isbn: string,
  all: BookSourcePlugin[],
  cfg: PluginConfig,
): Promise<RunByIsbnResult> {
  const reports: PluginCallReport[] = [];

  const isbnPs = pluginsFor(all, cfg, "isbn");
  const phase1Wrapped = await Promise.all(
    isbnPs.map((p) =>
      withPluginTimeout(
        p,
        (s) => p.searchByISBN!(isbn, s),
        (v) => v === null,
      ),
    ),
  );
  const phase1: Candidate[] = isbnPs.map((p, i) => ({
    pluginId: p.id,
    result: phase1Wrapped[i].value,
  }));
  reports.push(...phase1Wrapped.map((w) => w.report));

  const withTitle = sortByPriority(phase1, cfg).find((c) => c.result?.title);
  const discoveredTitle = withTitle?.result?.title;

  let phase2: Candidate[] = [];
  if (discoveredTitle) {
    const titlePs = pluginsFor(all, cfg, "title").filter((p) => !p.searchByISBN);
    const phase2Wrapped = await Promise.all(
      titlePs.map((p) =>
        withPluginTimeout(
          p,
          (s) => p.searchByTitle!(discoveredTitle, s),
          (v) => !v || v.length === 0,
        ),
      ),
    );
    phase2 = titlePs.map((p, i) => ({
      pluginId: p.id,
      result: phase2Wrapped[i].value?.[0] ?? null,
    }));
    reports.push(...phase2Wrapped.map((w) => w.report));
  }

  const sorted = sortByPriority([...phase1, ...phase2], cfg);
  const merged = mergeResults(sorted.map((c) => c.result));
  if (merged && !merged.isbn) merged.isbn = isbn;
  return { book: merged, sources: reports };
}

export async function runByISBN(
  isbn: string,
  all: BookSourcePlugin[],
  cfg: PluginConfig,
): Promise<RunByIsbnResult> {
  const first = await runByIsbnOnce(isbn, all, cfg);
  const tagged = first.sources.map((s) => ({ ...s, attempt: "primary" as const }));
  if (first.book) return { book: first.book, sources: tagged };
  const alt = alternateISBN(isbn);
  if (!alt) return { book: null, sources: tagged };
  const retry = await runByIsbnOnce(alt, all, cfg);
  return {
    book: retry.book,
    sources: [...tagged, ...retry.sources.map((s) => ({ ...s, attempt: "alt" as const }))],
  };
}

export interface AggregateResult {
  results: BookSearchResult[];
  sources: PluginCallReport[];
}

async function runAggregate(
  cap: "title" | "author" | "series" | "text",
  method: keyof Pick<
    BookSourcePlugin,
    "searchByTitle" | "searchByAuthor" | "searchBySeries" | "searchByText"
  >,
  q: string,
  all: BookSourcePlugin[],
  cfg: PluginConfig,
): Promise<AggregateResult> {
  const ps = pluginsFor(all, cfg, cap);
  const wrapped = await Promise.all(
    ps.map((p) => {
      const fn = p[method] as (q: string, s: AbortSignal) => Promise<BookSearchResult[]>;
      return withPluginTimeout(
        p,
        (s) => fn.call(p, q, s),
        (v) => !v || v.length === 0,
      );
    }),
  );

  const seen = new Set<string>();
  const out: BookSearchResult[] = [];
  for (const w of wrapped) {
    for (const r of w.value ?? []) {
      const key = r.isbn || `${r.title}::${(r.authors || []).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return { results: out, sources: wrapped.map((w) => w.report) };
}

export const runByTitle = (q: string, all: BookSourcePlugin[], cfg: PluginConfig) =>
  runAggregate("title", "searchByTitle", q, all, cfg);
export const runByAuthor = (q: string, all: BookSourcePlugin[], cfg: PluginConfig) =>
  runAggregate("author", "searchByAuthor", q, all, cfg);
export const runBySeries = (q: string, all: BookSourcePlugin[], cfg: PluginConfig) =>
  runAggregate("series", "searchBySeries", q, all, cfg);
export const runByText = (q: string, all: BookSourcePlugin[], cfg: PluginConfig) =>
  runAggregate("text", "searchByText", q, all, cfg);

export interface CoverRunResult {
  covers: string[];
  sources: PluginCallReport[];
}

export async function runCoverSearch(
  ctx: CoverSearchContext,
  all: BookSourcePlugin[],
  cfg: PluginConfig,
): Promise<CoverRunResult> {
  const ps = pluginsFor(all, cfg, "cover");
  const wrapped = await Promise.all(
    ps.map((p) =>
      withPluginTimeout(
        p,
        (s) => p.findCovers!(ctx, s),
        (v) => !v || v.length === 0,
      ),
    ),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of wrapped) {
    for (const url of w.value ?? []) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return { covers: out, sources: wrapped.map((w) => w.report) };
}
