import { searchByText } from "./bookApi";
import type { BookSearchResult } from "@/types/book";

export async function searchByOCR(imageUrl: string): Promise<BookSearchResult[]> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(imageUrl);
    await worker.terminate();

    // Take the first few meaningful lines as the search query
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2 && /[a-zA-Z]/.test(l));

    const query = lines.slice(0, 4).join(" ").substring(0, 100);
    if (!query) return [];

    return searchByText(query);
  } catch (e) {
    console.warn("OCR failed:", e);
    return [];
  }
}
