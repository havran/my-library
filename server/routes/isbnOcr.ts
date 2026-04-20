import { Router } from "express";
import sharp from "sharp";
import { logger } from "../logger.js";

export const isbnOcrRouter: Router = Router();

let _ocrWorkerPromise: Promise<unknown> | null = null;
function getOCRWorker() {
  if (!_ocrWorkerPromise) {
    _ocrWorkerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      const w = await createWorker("eng");
      await w.setParameters({
        tessedit_char_whitelist: "0123456789ISBN-", // allow some extra chars that commonly appear in OCRed book spines, but only digits for the actual ISBN part
        // sparse text — best for scattered numbers
        tessedit_pageseg_mode: "7" as unknown as never,
      });
      return w;
    })();
  }
  return _ocrWorkerPromise as Promise<{
    recognize: (buf: Buffer) => Promise<{ data: { text: string } }>;
  }>;
}

async function preprocessISBN(buffer: Buffer, invert: boolean): Promise<Buffer> {
  let pipeline = sharp(buffer).greyscale().normalise().sharpen();
  if (invert) pipeline = pipeline.negate();
  return pipeline.threshold(140).png().toBuffer();
}

// ISBN-10 checksum: sum(d[i] * (10 - i)) for i = 0..9 must be divisible by 11.
// We restrict to pure digits here because the OCR worker's whitelist is digits-only,
// so books whose check digit is 'X' can't be recognized anyway.
function isValidIsbn10(s: string): boolean {
  if (s.length !== 10) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (10 - i) * Number(s[i]);
  return sum % 11 === 0;
}

export function extractISBN(text: string): { isbn: string | null; partial: string | null } {
  const digits = text.replace(/[^0-9]/g, "");
  // ISBN-13 first — the 978/979 prefix is unambiguous
  const isbn13 = digits.match(/97[89]\d{10}/)?.[0];
  if (isbn13) return { isbn: isbn13, partial: null };
  // ISBN-10: scan every 10-digit window, accept the first that checksums.
  for (let i = 0; i + 10 <= digits.length; i++) {
    const candidate = digits.slice(i, i + 10);
    if (isValidIsbn10(candidate)) return { isbn: candidate, partial: null };
  }
  const partial = digits.match(/97[89]\d{0,9}/)?.[0] ?? null;
  return { isbn: null, partial: partial && partial.length >= 6 ? partial : null };
}

isbnOcrRouter.post("/", async (req, res) => {
  const { image, debug } = req.body as { image?: string; debug?: boolean };
  if (!image) {
    res.status(400).json({ error: "image required" });
    return;
  }

  try {
    const inputBuffer = Buffer.from(image, "base64");
    const worker = await getOCRWorker();

    const [normal, inverted] = await Promise.all([
      preprocessISBN(inputBuffer, false),
      preprocessISBN(inputBuffer, true),
    ]);

    const [r1, r2] = await Promise.all([worker.recognize(normal), worker.recognize(inverted)]);

    const raw = `${r1.data.text} ${r2.data.text}`.replace(/\s+/g, " ").trim();
    const result = extractISBN(raw);
    logger.debug({ source: "isbn-ocr", raw, isbn: result.isbn, partial: result.partial }, "ocr");

    if (debug) {
      res.json({ ...result, raw, debugImage: normal.toString("base64") });
    } else {
      res.json(result);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "isbn-ocr error";
    logger.warn({ source: "isbn-ocr", err: msg }, "isbn-ocr error");
    res.status(500).json({ isbn: null, partial: null });
  }
});
