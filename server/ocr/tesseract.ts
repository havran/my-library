import type { OcrProvider } from "./types.js";

// tesseract.js Worker recognize() is single-threaded; serialize calls to avoid
// corrupting internal state when the route fires normal+inverted in parallel.
export async function createTesseractProvider(): Promise<OcrProvider> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  await worker.setParameters({
    tessedit_char_whitelist: "0123456789ISBN-",
    tessedit_pageseg_mode: "7" as unknown as never,
  });

  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };

  return {
    id: "tesseract",
    recognize: (buf) =>
      enqueue(async () => {
        const { data } = await worker.recognize(buf);
        return data.text;
      }),
    destroy: async () => {
      await worker.terminate();
    },
  };
}
