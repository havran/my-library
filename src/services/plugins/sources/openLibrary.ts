import type { BookSourcePlugin } from "../types";

const BASE = "https://openlibrary.org";
const COVERS = "https://covers.openlibrary.org";

export const openLibraryPlugin: BookSourcePlugin = {
  id: "open-library",
  name: "Open Library",
  description: "Internet Archive's open book catalog.",
  timeoutMs: 6000,

  async searchByISBN(isbn, signal) {
    const res = await fetch(`${BASE}/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, {
      signal,
    });
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
