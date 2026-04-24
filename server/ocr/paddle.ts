import type { OcrProvider } from "./types.js";

// onnxruntime session.run() is not safe to call concurrently on the same
// session; serialize recognize() calls so a parallel normal+inverted pair
// from the route doesn't race the underlying ONNX session.
export async function createPaddleProvider(): Promise<OcrProvider> {
  const { PaddleOcrService } = await import("ppu-paddle-ocr");
  // Explicit thread counts suppress onnxruntime's pthread_setaffinity_np attempts,
  // which fail with EINVAL on constrained CPU sets (containers/LXC, some VMs) and
  // spam the log. Single-threaded is fine for short ISBN crops.
  const service = new PaddleOcrService({
    session: { intraOpNumThreads: 1, interOpNumThreads: 1 },
  });
  await service.initialize();

  let chain: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.catch(() => undefined);
    return next;
  };

  return {
    id: "paddle",
    recognize: (buf) =>
      enqueue(async () => {
        const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
        const result = await service.recognize(ab);
        return result.text;
      }),
    destroy: async () => {
      await service.destroy();
    },
  };
}
