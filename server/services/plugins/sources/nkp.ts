import { rateLimitedFetch } from "../../../http.js";
import type { BookSearchResult, BookSourcePlugin } from "../types.js";

const UPSTREAM = "https://aleph.nkp.cz/X";

function extractVarfields(xml: string, fieldId: string): Array<Record<string, string[]>> {
  const out: Array<Record<string, string[]>> = [];
  const vfRe = new RegExp(`<varfield[^>]*id="${fieldId}"[^>]*>([\\s\\S]*?)<\\/varfield>`, "g");
  let vm: RegExpExecArray | null;
  while ((vm = vfRe.exec(xml)) !== null) {
    const subs: Record<string, string[]> = {};
    const sfRe = /<subfield[^>]*label="([^"]+)"[^>]*>([\s\S]*?)<\/subfield>/g;
    let sm: RegExpExecArray | null;
    while ((sm = sfRe.exec(vm[1])) !== null) {
      const label = sm[1];
      const val = sm[2]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .trim();
      if (!val) continue;
      (subs[label] ??= []).push(val);
    }
    out.push(subs);
  }
  return out;
}

function parseNkpMarc(xml: string, cleanIsbn: string): BookSearchResult | null {
  const f245 = extractVarfields(xml, "245")[0] ?? {};
  const titleA = (f245.a?.[0] ?? "").replace(/\s*\/\s*$/, "").trim();
  const titleB = (f245.b?.[0] ?? "").replace(/\s*\/\s*$/, "").trim();
  const title = titleB ? `${titleA}: ${titleB}` : titleA;
  if (!title) return null;

  const f100a = extractVarfields(xml, "100").flatMap((v) => v.a ?? []);
  const f700a = extractVarfields(xml, "700").flatMap((v) => v.a ?? []);
  const authors = [...f100a, ...f700a].map((a) => a.replace(/,\s*$/, "").trim()).filter(Boolean);

  const f264b = extractVarfields(xml, "264").flatMap((v) => v.b ?? [])[0] ?? "";
  const f260b = extractVarfields(xml, "260").flatMap((v) => v.b ?? [])[0] ?? "";
  const publisher = (f264b || f260b).replace(/,\s*$/, "").trim();

  const f300a = extractVarfields(xml, "300").flatMap((v) => v.a ?? [])[0] ?? "";
  const pageCount = parseInt(f300a.match(/(\d+)\s*(?:stran|s\.|pages?)/i)?.[1] ?? "") || null;

  const description = extractVarfields(xml, "520").flatMap((v) => v.a ?? [])[0] ?? "";

  const genres = extractVarfields(xml, "650")
    .flatMap((v) => v.a ?? [])
    .map((g) => g.replace(/[-–—,\s]+$/, "").trim())
    .filter(Boolean)
    .slice(0, 5);

  const isbnRaw = (extractVarfields(xml, "020").flatMap((v) => v.a ?? [])[0] ?? "")
    .replace(/\s.*$/, "")
    .replace(/-/g, "");

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

  async searchByISBN(isbn, signal) {
    const cleanIsbn = isbn.replace(/-/g, "");

    const findParams = new URLSearchParams({
      op: "find",
      request: `sbn=${cleanIsbn}`,
      base: "nkc",
    });
    const findRes = await rateLimitedFetch(`${UPSTREAM}?${findParams.toString()}`, { signal });
    if (!findRes.ok) return null;
    const findXml = await findRes.text();

    const noRecords = parseInt(
      findXml.match(/<no_records>\s*0*(\d+)\s*<\/no_records>/)?.[1] ?? "0",
    );
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
    const presentRes = await rateLimitedFetch(`${UPSTREAM}?${presentParams.toString()}`, {
      signal,
    });
    if (!presentRes.ok) return null;
    const presentXml = await presentRes.text();

    return parseNkpMarc(presentXml, cleanIsbn);
  },
};
