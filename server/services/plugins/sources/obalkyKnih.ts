import { rateLimitedFetch } from "../../../http.js";
import type { BookSourcePlugin } from "../types.js";

const UPSTREAM = "https://www.obalkyknih.cz/api/books";

export const obalkyKnihPlugin: BookSourcePlugin = {
  id: "obalky-knih",
  name: "obalkyknih.cz",
  description: "Czech cover image database.",
  timeoutMs: 6000,

  async findCovers({ isbn }, signal) {
    if (!isbn) return [];
    const params = new URLSearchParams({ isbn, keywords: "" });
    const r = await rateLimitedFetch(`${UPSTREAM}?${params.toString()}`, { signal });
    if (!r.ok) return [];
    const data = (await r.json()) as Array<{
      cover_medium_url?: string;
      thumbnail_url?: string;
    }>;
    const url = data?.[0]?.cover_medium_url || data?.[0]?.thumbnail_url;
    return url ? [url] : [];
  },
};
