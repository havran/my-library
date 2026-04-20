import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reportClientError } from "./errorReporter";

describe("reportClientError", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
    // Force the fetch path by pretending sendBeacon is unavailable
    Object.defineProperty(navigator, "sendBeacon", { value: undefined, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("POSTs JSON to /api/log/client", () => {
    reportClientError({ message: "boom-1" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/log/client",
      expect.objectContaining({ method: "POST" }),
    );
    const call = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ level: "error", message: "boom-1" });
    expect(body.url).toBeTypeOf("string");
  });

  it("defaults level to error", () => {
    reportClientError({ message: "boom-2" });
    const body = JSON.parse((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.level).toBe("error");
  });

  it("coalesces duplicate reports within 5s", () => {
    reportClientError({ message: "dup" });
    reportClientError({ message: "dup" });
    reportClientError({ message: "dup" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports again after the coalesce window", () => {
    vi.useFakeTimers();
    reportClientError({ message: "spread" });
    vi.advanceTimersByTime(6000);
    reportClientError({ message: "spread" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
