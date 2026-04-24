export type OcrProviderId = "paddle" | "tesseract";

export interface OcrProvider {
  id: OcrProviderId;
  recognize(buf: Buffer): Promise<string>;
  destroy?(): Promise<void>;
}
