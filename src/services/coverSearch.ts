import { searchByText } from "./bookApi";
import { fetchImageAsBase64 } from "./imageCache";
import { apiFetch } from "./apiFetch";
import type { BookSearchResult } from "@/types/book";

export interface OCRResult {
  results: BookSearchResult[];
  query: string;
}

interface CoverResponse {
  covers: string[];
  sources: { id: string; status: string; ms: number }[];
}

async function fetchCovers(params: URLSearchParams): Promise<string[]> {
  try {
    const res = await apiFetch(`/api/metadata?mode=cover&${params.toString()}`);
    if (!res.ok) return [];
    const data = (await res.json()) as CoverResponse;
    return data.covers ?? [];
  } catch {
    return [];
  }
}

/** Find the first cover URL for a book. Server-cached, so first element is safe to use directly. */
export async function searchCoverByISBN(isbn: string, title: string): Promise<string> {
  const params = new URLSearchParams();
  if (isbn) params.set("isbn", isbn);
  if (title) params.set("title", title);
  const urls = await fetchCovers(params);
  return urls[0] ?? "";
}

/** Return all cover URLs (already server-validated/cached). */
export async function searchAllCovers(isbn: string, title: string): Promise<string[]> {
  const params = new URLSearchParams();
  if (isbn) params.set("isbn", isbn);
  if (title) params.set("title", title);
  return fetchCovers(params);
}

/** Download a cover URL as base64 data URI (for offline persistence). */
export async function downloadCover(url: string): Promise<string> {
  return fetchImageAsBase64(url);
}

export async function searchByOCR(imageUrl: string): Promise<OCRResult> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(imageUrl);
    await worker.terminate();

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 1 && /\p{L}/u.test(l));

    const query = lines.slice(0, 4).join(" ").substring(0, 100);
    if (!query) return { results: [], query: "" };

    const results = await searchByText(query);
    return { results, query };
  } catch (e) {
    console.warn("OCR failed:", e);
    return { results: [], query: "" };
  }
}
