import type { BookSourcePlugin } from "../types";
import { apiFetch } from "@/services/apiFetch";

const PROXY = "/api/openLibrary";
const COVERS = "https://covers.openlibrary.org";

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
    const res = await apiFetch(`${PROXY}?${params.toString()}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    const b = data[`ISBN:${isbn}`];
    if (!b) return null;
    return {
      isbn,
      title: b.title || "Unknown Title",
      authors: (b.authors || []).map((a: any) => a.name),
      genres: (b.subjects || []).slice(0, 5).map((s: any) => s.name),
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
