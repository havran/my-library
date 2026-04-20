import { searchByText } from "./bookApi";
import { fetchImageAsBase64 } from "./imageCache";
import { runCoverSearch } from "./plugins";
import type { BookSearchResult } from "@/types/book";

export interface OCRResult {
  results: BookSearchResult[];
  query: string;
}

function tryImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.src = "";
      resolve(false);
    }, 5000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

/** Find the first working cover image URL for a book, via registered plugins. */
export async function searchCoverByISBN(isbn: string, title: string): Promise<string> {
  const urls = await runCoverSearch({ isbn, title });
  for (const url of urls) {
    if (await tryImageUrl(url)) return url;
  }
  return "";
}

/** Return all working cover URLs from all enabled plugins, in priority order. */
export async function searchAllCovers(isbn: string, title: string): Promise<string[]> {
  const urls = await runCoverSearch({ isbn, title });
  const results = await Promise.all(urls.map(async (url) => ({ url, ok: await tryImageUrl(url) })));
  return results.filter((r) => r.ok).map((r) => r.url);
}

/** Download a cover URL as base64 data URI. */
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
