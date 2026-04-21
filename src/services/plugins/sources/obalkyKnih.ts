import type { BookSourcePlugin } from "../types";
import { apiFetch } from "@/services/apiFetch";

const PROXY = "/api/obalkyKnih";

export const obalkyKnihPlugin: BookSourcePlugin = {
  id: "obalky-knih",
  name: "obalkyknih.cz",
  description: "Czech cover image database.",
  timeoutMs: 6000,

  async findCovers({ isbn }, signal) {
    if (!isbn) return [];
    const params = new URLSearchParams({ isbn, keywords: "" });
    const res = await apiFetch(`${PROXY}?${params.toString()}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const url = data?.[0]?.cover_medium_url || data?.[0]?.thumbnail_url;
    return url ? [url] : [];
  },
};
