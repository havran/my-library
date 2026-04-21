import type { BookSearchResult } from "@/types/book";
import type { BookSourcePlugin } from "../types";
import { apiFetch } from "@/services/apiFetch";

const PROXY = "/api/nkp";

/**
 * Two-step: (1) find set_number by ISBN, (2) fetch OAI-MARC record.
 * NKP does not serve cover images.
 */
async function fetchFromNKP(isbn: string, signal: AbortSignal): Promise<BookSearchResult | null> {
  const cleanIsbn = isbn.replace(/-/g, "");

  const findParams = new URLSearchParams({
    op: "find",
    request: `sbn=${cleanIsbn}`,
    base: "nkc",
  });
  const findRes = await apiFetch(`${PROXY}?${findParams.toString()}`, { signal });
  if (!findRes.ok) return null;
  const findXml = await findRes.text();

  const noRecords = parseInt(findXml.match(/<no_records>\s*0*(\d+)\s*<\/no_records>/)?.[1] ?? "0");
  if (noRecords === 0) return null;

  const setNumber = findXml.match(/<set_number>\s*0*(\d+)\s*<\/set_number>/)?.[1];
  if (!setNumber) return null;

  const presentParams = new URLSearchParams({
    op: "present",
    set_number: setNumber,
    set_entry: "1-1",
    format: "marc",
    base: "nkc",
  });
  const presentRes = await apiFetch(`${PROXY}?${presentParams.toString()}`, { signal });
  if (!presentRes.ok) return null;
  const presentXml = await presentRes.text();

  const dom = new DOMParser().parseFromString(presentXml, "text/xml");
  if (dom.querySelector("parsererror")) return null;

  const getSubfields = (fieldId: string, subfieldLabel: string): string[] => {
    const results: string[] = [];
    dom.querySelectorAll(`varfield[id="${fieldId}"]`).forEach((vf) => {
      vf.querySelectorAll(`subfield[label="${subfieldLabel}"]`).forEach((sf) => {
        const t = sf.textContent?.trim();
        if (t) results.push(t);
      });
    });
    return results;
  };
  const sub = (f: string, l: string) => getSubfields(f, l)[0] ?? "";

  const titleA = sub("245", "a")
    .replace(/\s*\/\s*$/, "")
    .trim();
  const titleB = sub("245", "b")
    .replace(/\s*\/\s*$/, "")
    .trim();
  const title = titleB ? `${titleA}: ${titleB}` : titleA;
  if (!title) return null;

  const authors = [sub("100", "a"), ...getSubfields("700", "a")]
    .map((a) => a.replace(/,\s*$/, "").trim())
    .filter(Boolean);

  const publisher = (sub("264", "b") || sub("260", "b")).replace(/,\s*$/, "").trim();

  const pagesRaw = sub("300", "a");
  const pageCount = parseInt(pagesRaw.match(/(\d+)\s*(?:stran|s\.|pages?)/i)?.[1] ?? "") || null;

  const description = sub("520", "a");

  const genres = getSubfields("650", "a")
    .map((g) => g.replace(/[-–—,\s]+$/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  const isbnRaw = sub("020", "a").replace(/\s.*$/, "").replace(/-/g, "");

  return {
    isbn: isbnRaw || cleanIsbn,
    title,
    authors,
    genres,
    description,
    publisher,
    pageCount,
    coverUrl: "",
    averageRating: null,
    ratingsCount: null,
  };
}

export const nkpPlugin: BookSourcePlugin = {
  id: "nkp-aleph",
  name: "NKP (Czech National Library)",
  description: "Aleph X-Server catalog, MARC21 records. No covers.",
  timeoutMs: 10000,
  searchByISBN: fetchFromNKP,
};
