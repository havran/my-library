import { apiFetch } from "./apiFetch";

const SAVE_DEBOUNCE_MS = 500;
const pendingTimers = new Map<string, number>();
const pendingValues = new Map<string, unknown>();

export async function loadAllSettings(): Promise<Record<string, unknown>> {
  try {
    const res = await apiFetch("/api/settings", { credentials: "include" });
    if (!res.ok) return {};
    return (await res.json()) as Record<string, unknown>;
  } catch {
    // Network failure during auth bootstrap — don't block the user; they
    // just won't get their synced prefs this session. The plugin store
    // stays unhydrated, so subsequent edits won't overwrite server state.
    return {};
  }
}

// Per-key debounce so a burst of reorder clicks coalesces into one PUT but
// unrelated keys don't block each other.
export function saveSetting(key: string, value: unknown): void {
  pendingValues.set(key, value);
  const existing = pendingTimers.get(key);
  if (existing !== undefined) window.clearTimeout(existing);
  const handle = window.setTimeout(() => {
    pendingTimers.delete(key);
    const v = pendingValues.get(key);
    pendingValues.delete(key);
    void flush(key, v);
  }, SAVE_DEBOUNCE_MS);
  pendingTimers.set(key, handle);
}

async function flush(key: string, value: unknown): Promise<void> {
  try {
    await apiFetch(`/api/settings/${encodeURIComponent(key)}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
  } catch {
    // Settings sync is best-effort; a failed PUT just means this device's
    // next change will retry. Avoid surfacing transient network noise.
  }
}
