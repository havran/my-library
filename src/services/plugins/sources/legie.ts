import type { BookSearchResult } from "@/types/book";
import type { BookSourcePlugin } from "../types";
import { apiFetch } from "@/services/apiFetch";

interface LegieResult {
  title: string;
  authors: string[];
  coverUrl: string;
  genres: string[];
  averageRating: number | null;
  ratingsCount: number | null;
  series: string;
  seriesNumber: string;
  serieSlug: string;
  description: string;
  editions?: { coverUrl: string }[];
}

async function fetchLegie(title: string, signal: AbortSignal): Promise<LegieResult | null> {
  if (!title) return null;
  const res = await apiFetch(`/api/legie?title=${encodeURIComponent(title)}`, { signal });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d?.title) return null;
  return d as LegieResult;
}

function toBookResult(d: LegieResult): BookSearchResult {
  return {
    isbn: null,
    title: d.title,
    authors: d.authors || [],
    genres: d.genres || [],
    description: d.description || "",
    publisher: "",
    pageCount: null,
    coverUrl: d.coverUrl || "",
    averageRating: d.averageRating ?? null,
    ratingsCount: d.ratingsCount ?? null,
    series: d.series || "",
    seriesNumber: d.seriesNumber || "",
    serieSlug: d.serieSlug || "",
  };
}

export const legiePlugin: BookSourcePlugin = {
  id: "legie",
  name: "legie.info",
  description: "Czech/Slovak SF/fantasy database — ratings, series, editions.",
  timeoutMs: 12000,

  async searchByTitle(title, signal) {
    const d = await fetchLegie(title, signal);
    return d ? [toBookResult(d)] : [];
  },

  async findCovers({ title }, signal) {
    if (!title) return [];
    const d = await fetchLegie(title, signal);
    if (!d) return [];
    const urls: string[] = [];
    if (d.editions?.length) urls.push(...d.editions.map((e) => e.coverUrl));
    if (d.coverUrl) urls.push(d.coverUrl);
    return urls.filter(Boolean);
  },
};
