import { rateLimitedFetch } from "../../../http.js";
import type { BookSearchResult, BookSourcePlugin } from "../types.js";

const UPSTREAM = "https://openlibrary.org/api/books";
const COVERS = "https://covers.openlibrary.org";

interface OlBook {
  title?: string;
  authors?: { name: string }[];
  subjects?: { name: string }[];
  notes?: string;
  publishers?: { name: string }[];
  number_of_pages?: number;
  cover?: { large?: string; medium?: string };
}

export const openLibraryPlugin: BookSourcePlugin = {
  id: "open-library",
  name: "Open Library",
  description: "Internet Archive's open book catalog.",
  timeoutMs: 6000,

  async searchByISBN(isbn, signal) {
    const params = new URLSearchParams({
      bibkeys: `ISBN:${isbn}`,
      format: "json",
      jscmd: "data",
    });
    const r = await rateLimitedFetch(`${UPSTREAM}?${params.toString()}`, { signal });
    if (!r.ok) return null;
    const data = (await r.json()) as Record<string, OlBook>;
    const b = data[`ISBN:${isbn}`];
    if (!b) return null;
    return {
      isbn,
      title: b.title || "Unknown Title",
      authors: (b.authors || []).map((a) => a.name),
      genres: (b.subjects || []).slice(0, 5).map((s) => s.name),
      description: b.notes || "",
      publisher: b.publishers?.[0]?.name || "",
      pageCount: b.number_of_pages || null,
      coverUrl: b.cover?.large || b.cover?.medium || "",
      averageRating: null,
      ratingsCount: null,
    };
  },

  async findCovers({ isbn }) {
    if (!isbn) return [];
    return [`${COVERS}/b/isbn/${isbn}-L.jpg?default=false`];
  },
};
