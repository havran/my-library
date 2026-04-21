type Level = "error" | "warn" | "info";

interface ReportPayload {
  level?: Level;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

// Coalesce identical errors to avoid flooding the server on a broken render loop.
const RECENT_WINDOW_MS = 5000;
const recent = new Map<string, number>();

function shouldReport(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < RECENT_WINDOW_MS) return false;
  recent.set(key, now);
  // Keep the map from growing unbounded
  if (recent.size > 50) {
    for (const [k, t] of recent) if (now - t > RECENT_WINDOW_MS * 4) recent.delete(k);
  }
  return true;
}

export function reportClientError(p: ReportPayload): void {
  const key = `${p.level ?? "error"}:${p.message}`;
  if (!shouldReport(key)) return;

  const body = JSON.stringify({
    level: p.level ?? "error",
    message: p.message,
    stack: p.stack,
    url: window.location.href,
    context: p.context,
  });

  // sendBeacon is fire-and-forget and survives page unload; fall back to fetch.
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/log/client", blob)) return;
    }
  } catch {
    // sendBeacon can throw under some CSP configs — fall through to fetch
  }

  void fetch("/api/log/client", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Nothing we can do if reporting itself fails
  });
}

export function installGlobalErrorReporter(): void {
  window.addEventListener("error", (event) => {
    reportClientError({
      level: "error",
      message: event.message || "window.error",
      stack: event.error?.stack,
      context: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "unhandled";
    if (isBenignCameraRejection(message)) return;
    reportClientError({
      level: "error",
      message: `unhandledrejection: ${message}`,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}

// Chromium on Android rejects internally when an unsupported MediaTrack
// constraint (e.g. focusMode: "continuous") gets applied to the camera.
// The camera still works — the rejection is cosmetic, not actionable.
function isBenignCameraRejection(message: string): boolean {
  return /setPhotoOptions failed|applyConstraints.*not supported/i.test(message);
}
