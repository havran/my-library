import { getServerSetting } from "../db.js";
import { logger } from "../logger.js";
import { createPaddleProvider } from "./paddle.js";
import { createTesseractProvider } from "./tesseract.js";
import type { OcrProvider, OcrProviderId } from "./types.js";

export const OCR_PROVIDERS = ["paddle", "tesseract"] as const satisfies readonly OcrProviderId[];

export function isOcrProviderId(v: unknown): v is OcrProviderId {
  return typeof v === "string" && (OCR_PROVIDERS as readonly string[]).includes(v);
}

// Env var is the boot-time default; DB overrides so operators can flip providers
// at runtime from the Settings UI without redeploying.
function envDefault(): OcrProviderId {
  return isOcrProviderId(process.env.OCR_PROVIDER) ? process.env.OCR_PROVIDER : "paddle";
}

export function getConfiguredProviderId(): OcrProviderId {
  const fromDb = getServerSetting("ocr_provider");
  return isOcrProviderId(fromDb) ? fromDb : envDefault();
}

let current: { id: OcrProviderId; promise: Promise<OcrProvider> } | null = null;

function build(id: OcrProviderId): Promise<OcrProvider> {
  return id === "paddle" ? createPaddleProvider() : createTesseractProvider();
}

export function getOcrProvider(): Promise<OcrProvider> {
  const id = getConfiguredProviderId();
  if (current && current.id === id) return current.promise;

  // Provider changed (or first call). Dispose the old instance in the background
  // so the new singleton can start initializing without waiting on teardown.
  if (current) disposeInBackground(current.promise);

  const promise = build(id).catch((err) => {
    logger.error({ err, id }, "OCR provider init failed");
    if (current?.id === id) current = null;
    throw err;
  });
  current = { id, promise };
  return promise;
}

export function resetOcrProvider(): void {
  if (!current) return;
  const prev = current;
  current = null;
  disposeInBackground(prev.promise);
}

function disposeInBackground(p: Promise<OcrProvider>): void {
  p.then((provider) => provider.destroy?.()).catch((err) =>
    logger.warn({ err }, "OCR provider destroy failed"),
  );
}
