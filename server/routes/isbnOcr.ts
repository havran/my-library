import { Router } from "express";
import sharp from "sharp";
import { logger } from "../logger.js";
import { getOcrProvider } from "../ocr/index.js";

export const isbnOcrRouter: Router = Router();

async function preprocessISBN(buffer: Buffer, invert: boolean): Promise<Buffer> {
  let pipeline = sharp(buffer).greyscale().normalise().sharpen();
  if (invert) pipeline = pipeline.negate();
  return pipeline.threshold(140).png().toBuffer();
}

// ISBN-10 checksum: sum(d[i] * (10 - i)) for i = 0..9 must be divisible by 11.
// Last position may be 'X' (value 10); earlier positions are digits only.
function isValidIsbn10(s: string): boolean {
  if (!/^\d{9}[\dX]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (10 - i) * Number(s[i]);
  sum += s[9] === "X" ? 10 : Number(s[9]);
  return sum % 11 === 0;
}

export function extractISBN(text: string): { isbn: string | null; partial: string | null } {
  // Keep X so ISBN-10 check digits survive; uppercase to normalize 'x' OCR output.
  const normalized = text.replace(/[^0-9xX]/g, "").toUpperCase();
  // ISBN-13 first — the 978/979 prefix is unambiguous, and the 13 positions
  // are all digits so X cannot appear inside a valid match.
  const isbn13 = normalized.match(/97[89]\d{10}/)?.[0];
  if (isbn13) return { isbn: isbn13, partial: null };
  // ISBN-10: scan every 10-char window (9 digits + digit-or-X), accept first checksum.
  for (let i = 0; i + 10 <= normalized.length; i++) {
    const candidate = normalized.slice(i, i + 10);
    if (isValidIsbn10(candidate)) return { isbn: candidate, partial: null };
  }
  const partial = normalized.match(/97[89]\d{0,9}/)?.[0] ?? null;
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
    const provider = await getOcrProvider();

    const [normal, inverted] = await Promise.all([
      preprocessISBN(inputBuffer, false),
      preprocessISBN(inputBuffer, true),
    ]);

    const [t1, t2] = await Promise.all([provider.recognize(normal), provider.recognize(inverted)]);

    const raw = `${t1} ${t2}`.replace(/\s+/g, " ").trim();
    const result = extractISBN(raw);
    logger.debug(
      {
        source: "isbn-ocr",
        provider: provider.id,
        raw,
        isbn: result.isbn,
        partial: result.partial,
      },
      "ocr",
    );

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
