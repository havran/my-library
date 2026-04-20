import type { BookSourcePlugin } from "../types";

const BASE = "https://www.obalkyknih.cz/api/books";

export const obalkyKnihPlugin: BookSourcePlugin = {
  id: "obalky-knih",
  name: "obalkyknih.cz",
  description: "Czech cover image database.",
  timeoutMs: 6000,

  async findCovers({ isbn }, signal) {
    if (!isbn) return [];
    const res = await fetch(`${BASE}?isbn=${isbn}&keywords=`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const url = data?.[0]?.cover_medium_url || data?.[0]?.thumbnail_url;
    return url ? [url] : [];
  },
};
