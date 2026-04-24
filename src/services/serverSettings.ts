import { apiFetch } from "./apiFetch";

export type OcrProviderId = "paddle" | "tesseract";

export interface ServerSettings {
  ocrProvider: OcrProviderId;
  ocrProviders: OcrProviderId[];
}

export async function fetchServerSettings(): Promise<ServerSettings | null> {
  try {
    const res = await apiFetch("/api/server-settings", { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as ServerSettings;
  } catch {
    return null;
  }
}

export async function setServerOcrProvider(provider: OcrProviderId): Promise<boolean> {
  try {
    const res = await apiFetch("/api/server-settings/ocr-provider", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
