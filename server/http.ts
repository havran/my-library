// Per-host rate limiter (1 s between requests to the same hostname) shared by all
// third-party scrapers. Keeps scraping polite and avoids cbdb/legie bot-detection.

const _lastRequestTime = new Map<string, number>();

export async function rateLimitedFetch(url: string, opts: RequestInit = {}): Promise<Response> {
  const host = new URL(url).hostname;
  const last = _lastRequestTime.get(host) ?? 0;
  const wait = Math.max(0, 1000 - (Date.now() - last));
  if (wait > 0) await new Promise<void>((r) => setTimeout(r, wait));
  _lastRequestTime.set(host, Date.now());
  return fetch(url, opts);
}

export const CZ_BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "cs-CZ,cs;q=0.9,sk;q=0.8",
};
