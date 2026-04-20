import type { BookSearchResult } from "@/types/book";
import { alternateISBN } from "@/utils/isbn";
import { pluginsFor, priorityIndex } from "./registry";
import type { BookSourcePlugin, CoverSearchContext } from "./types";

const DEFAULT_TIMEOUT = 8000;

function withPluginTimeout<T>(
  p: BookSourcePlugin,
  call: (signal: AbortSignal) => Promise<T>,
): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), p.timeoutMs ?? DEFAULT_TIMEOUT);
  return call(ctrl.signal)
    .then((v) => v)
    .catch((e) => {
      console.warn(`[${p.id}] failed:`, e);
      return null;
    })
    .finally(() => clearTimeout(timer));
}

// ── Merge ─────────────────────────────────────────────────────────────────────

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

/** Take each field from the first candidate (by user priority) with a non-empty value. */
export function mergeResults(candidates: (BookSearchResult | null)[]): BookSearchResult | null {
  const valid = candidates.filter(Boolean) as BookSearchResult[];
  if (!valid.length) return null;
  const out: Record<string, unknown> = {};
  for (const f of MERGE_FIELDS) {
    for (const c of valid) {
      const v = (c as any)[f];
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

// ── ISBN with two-phase enrichment ───────────────────────────────────────────

type Candidate = { pluginId: string; result: BookSearchResult | null };

function sortByPriority(cs: Candidate[]): Candidate[] {
  const idx = priorityIndex();
  return [...cs].sort((a, b) => {
    const ai = idx.get(a.pluginId) ?? Number.POSITIVE_INFINITY;
    const bi = idx.get(b.pluginId) ?? Number.POSITIVE_INFINITY;
    return ai - bi;
  });
}

async function runByISBNOnce(isbn: string): Promise<BookSearchResult | null> {
  // Phase 1 — direct ISBN plugins in parallel
  const isbnPs = pluginsFor("isbn");
  const phase1: Candidate[] = await Promise.all(
    isbnPs.map(async (p) => ({
      pluginId: p.id,
      result: await withPluginTimeout(p, (s) => p.searchByISBN!(isbn, s)),
    })),
  );

  // Discover a title from the highest-priority successful result for enrichment
  const withTitle = sortByPriority(phase1).find((c) => c.result?.title);
  const discoveredTitle = withTitle?.result?.title;

  // Phase 2 — title-only enrichers (plugins that can't do ISBN directly)
  let phase2: Candidate[] = [];
  if (discoveredTitle) {
    const titlePs = pluginsFor("title").filter((p) => !p.searchByISBN);
    phase2 = await Promise.all(
      titlePs.map(async (p) => {
        const rs = await withPluginTimeout(p, (s) => p.searchByTitle!(discoveredTitle, s));
        return { pluginId: p.id, result: rs?.[0] ?? null };
      }),
    );
  }

  const sorted = sortByPriority([...phase1, ...phase2]);
  const merged = mergeResults(sorted.map((c) => c.result));
  if (!merged) return null;
  if (!merged.isbn) merged.isbn = isbn;
  return merged;
}

export async function runByISBN(isbn: string): Promise<BookSearchResult | null> {
  const first = await runByISBNOnce(isbn);
  if (first) return first;
  // Fallback: old books printed with ISBN-10 may only be indexed under ISBN-13
  // (and vice versa). Try the other form before giving up.
  const alt = alternateISBN(isbn);
  if (!alt) return null;
  return runByISBNOnce(alt);
}

// ── Aggregate searches (title/author/series/text) ────────────────────────────

async function runAggregate(
  cap: "title" | "author" | "series" | "text",
  method: keyof Pick<
    BookSourcePlugin,
    "searchByTitle" | "searchByAuthor" | "searchBySeries" | "searchByText"
  >,
  q: string,
): Promise<BookSearchResult[]> {
  const ps = pluginsFor(cap);
  const groups = await Promise.all(
    ps.map(async (p) => {
      const fn = p[method] as
        | ((q: string, s: AbortSignal) => Promise<BookSearchResult[]>)
        | undefined;
      if (!fn) return [] as BookSearchResult[];
      const rs = await withPluginTimeout(p, (s) => fn.call(p, q, s));
      return rs ?? [];
    }),
  );
  const seen = new Set<string>();
  const out: BookSearchResult[] = [];
  for (const group of groups) {
    for (const r of group) {
      const key = r.isbn || `${r.title}::${(r.authors || []).join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

export const runByTitle = (q: string) => runAggregate("title", "searchByTitle", q);
export const runByAuthor = (q: string) => runAggregate("author", "searchByAuthor", q);
export const runBySeries = (q: string) => runAggregate("series", "searchBySeries", q);
export const runByText = (q: string) => runAggregate("text", "searchByText", q);

// ── Cover search ──────────────────────────────────────────────────────────────

export async function runCoverSearch(ctx: CoverSearchContext): Promise<string[]> {
  const ps = pluginsFor("cover");
  const groups = await Promise.all(
    ps.map((p) => withPluginTimeout(p, (s) => p.findCovers!(ctx, s))),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const url of group) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}
