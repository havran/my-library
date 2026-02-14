import { searchByText } from "./bookApi";
import type { BookSearchResult } from "@/types/book";

export async function searchByOCR(
  imageUri: string
): Promise<BookSearchResult[]> {
  try {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const {
      data: { text },
    } = await worker.recognize(imageUri);
    await worker.terminate();

    // Clean up OCR text: take first few meaningful lines
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 2);
    const query = lines.slice(0, 3).join(" ");

    if (!query) return [];

    return searchByText(query);
  } catch (e) {
    console.warn("OCR failed:", e);
    return [];
  }
}
