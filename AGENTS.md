# AGENTS.md

Canonical guidance for agents (and humans) working in this repository. Covers architecture, conventions, and common pitfalls. [CLAUDE.md](./CLAUDE.md) is a thin pointer to this file so both Claude Code and other agents read the same source.

## Workflow

Run `npm run typecheck` after any code change before considering a task done. Only run the full `npm run build` when verifying bundle output or PWA generation matters. Use `npm run test:run` for one-shot test runs.

## Deployment

**Dev server:** `ssh havran@192.168.1.141`

After changes, sync the built output (and server code + deps, if changed):

```bash
rsync -avz --delete dist/ havran@192.168.1.141:~/my-library/dist/
rsync -avz server/ havran@192.168.1.141:~/my-library/server/
rsync -avz package.json package-lock.json havran@192.168.1.141:~/my-library/  # whenever deps change
```

**Important:** the `dist/` target has a trailing `/dist/` on the remote — dropping it makes `--delete` wipe everything else in `~/my-library/` (server/, node_modules/, etc.).

Or just `npm run deploy` — it builds and rsyncs `dist/`, `server/`, `package.json`, `package-lock.json`, and `ecosystem.config.cjs`. Remote still needs `npm install` if package files changed.

The server process on the dev host serves both the built SPA (`dist/`) and the `/api/*` endpoints, reusing the same HTTPS listener on port 3001.

**Process management (pm2):** the remote server runs under pm2 using [ecosystem.config.cjs](ecosystem.config.cjs) (tsx interpreting `server/index.ts` directly, no server-side build step). First-time setup on the remote:

```bash
npm install -g pm2
cd ~/my-library && pm2 start ecosystem.config.cjs
pm2 save                      # persist process list
pm2 startup                   # prints a systemd command to run as root so pm2 starts on boot
```

After a deploy, reload the server with `ssh havran@192.168.1.141 'pm2 reload my-library'` (or `restart` for a hard restart). Logs live in `~/.local/share/my-library/logs/server-{out,error}.log` (alongside the DB) with pm2 prefixing each line with a timestamp; tail them with `pm2 logs my-library`. `pm2 status` for a snapshot.

To cap log growth, install pm2-logrotate once on the remote:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

## Commands

```bash
npm run dev          # concurrently runs Vite (hot reload) + tsx watch on server
npm run server       # Express API + static server only (port 3001, HTTPS if certs present)
npm run build        # tsc -b + Vite production build
npm run preview      # serve the production build locally
npm run typecheck    # tsc --noEmit

npm run test         # vitest (watch mode)
npm run test:run     # vitest one-shot
npm run test:coverage  # vitest with v8 coverage

npm run lint         # eslint .
npm run lint:fix     # eslint . --fix
npm run format       # prettier --write .
npm run format:check # prettier --check .

npm run deploy               # build + rsync to dev host (dist/, server/, package*, ecosystem.config.cjs)
npm run server:stop          # kill local :3001
npm run server:stop:remote   # pm2 stop my-library on dev host
npm run server:reload:remote # pm2 reload my-library on dev host
```

**Linting/formatting:** ESLint 9 (`eslint.config.js`) + Prettier, wired through **husky** + **lint-staged** so staged `.ts/.tsx` get `eslint --fix` + `prettier --write` and `.json/.md/.css/.html` get `prettier --write` on commit.

## Architecture

This is a **client-server app**, not a pure SPA. The React frontend talks to a local Express backend over `/api/*` for all persistence and for CORS/bot-blocked third-party sources.

### Stack — frontend (`src/`)

- **Vite 6 + React 19** — SPA shell, no SSR
- **React Router v7** — `BrowserRouter`, client-side routing
- **Tailwind CSS v3** — `darkMode: "class"` (toggled via `document.documentElement.classList`)
- **Zustand v5** — global state; single store `useLibraryStore`
- **vite-plugin-pwa + Workbox** — service worker, offline support, installable PWA
- **@vitejs/plugin-basic-ssl** — dev server uses self-signed HTTPS (needed for `getUserMedia` and PWA install)

### Stack — backend (`server/`)

- **Express 5** on port 3001
- **better-sqlite3** for persistence (synchronous API, WAL journal mode)
- **sharp** for ISBN-image preprocessing before OCR
- **Pluggable ISBN OCR** via `server/ocr/` — `ppu-paddle-ocr` (default, PaddleOCR on onnxruntime-node) or `tesseract.js`. Boot default from `OCR_PROVIDER` env; runtime override via `server_settings.ocr_provider` (admin-only, see `/api/server-settings`).
- **pino + pino-http** for structured logging (pretty-printed in dev, JSON in prod; `LOG_LEVEL` env var)
- **express-rate-limit** tiered per route group (see Rate limiting below)
- **bcryptjs + jsonwebtoken + cookie-parser** for authentication (JWT in an httpOnly cookie; see Authentication below)
- **cors** enabled (open) — backend runs on the LAN behind auth, browser shares origin via Vite proxy in dev
- **HTTPS** if `cert.pem` + `key.pem` are present in `~/.local/share/my-library/` (alongside the DB so they survive rsync deploys), HTTP otherwise

### Path alias

`@/` maps to `./src/` (configured in `vite.config.ts`, `tsconfig.json`, and `vitest.config.ts`).

### Storage

**SQLite** database at `~/.local/share/my-library/library.db` (`process.env.HOME` + `.local/share/my-library/`). Tables:

- **`books`** — schema in [server/db.ts](server/db.ts) mirrors the [Book](src/types/book.ts#L1-L21) interface, with `authors`/`genres` stored as JSON strings and `isRead` as 0/1.
- **`users`** — `id`, `username` (unique), `passwordHash` (bcrypt), `role`, timestamps. Admin is seeded on first boot (see Authentication).
- **`user_settings`** — `(user_id, key)` primary key, `value` is a JSON blob. Per-user key/value store for preferences that should sync across devices (currently plugin order/disabled; extensible without new migrations). Cascades on user delete.
- **`server_settings`** — `key` / `value` / `updatedAt`. Server-wide toggles (currently `ocr_provider`). Admin-only writes.

Downloaded cover images live under `~/.local/share/my-library/covers/<sha1>.{jpg|png|webp}` (content-addressed, served at `/api/covers/*`). See API endpoints → Static cover cache.

On startup the server copies `library.db` to `~/.local/share/my-library/backups/library-YYYY-MM-DD.db` (idempotent — one backup per calendar day). The JWT signing secret lives beside the DB at `~/.local/share/my-library/jwt-secret` (0600); override via `JWT_SECRET` env var.

### Data flow

1. App load → `App.tsx` calls `useLibraryStore().loadBooks()` → `GET /api/books` → populates Zustand `books` array.
2. All subsequent reads come from the in-memory Zustand array (no re-querying the API).
3. Writes are optimistic: Zustand updates immediately, `src/db/database.ts` sends the HTTP request, the server persists to SQLite.
4. Cover images are fetched as base64 via `src/services/imageCache.ts` and stored in `coverBase64` so they work offline. `coverUrl` is kept for re-fetch scenarios.

### Server layout

Third-party metadata lookups were consolidated server-side. The browser hits a single unified endpoint (`/api/metadata`) and the plugin registry + runner live in `server/services/plugins/` (moved from `src/` during the "one API only" refactor). Only the legie **series** page stays as a bespoke per-provider route because SeriesWizard needs its slug-based shape.

```
server/
  index.ts                     # app setup, HTTPS, router mounting
  db.ts                        # SQLite (better-sqlite3) helpers (books, users, user_settings, server_settings)
  http.ts                      # rateLimitedFetch + CZ_BROWSER_HEADERS (shared outbound)
  logger.ts                    # pino instance (pretty in dev, JSON in prod)
  auth.ts                      # JWT sign/verify, bcrypt hash/verify, requireAuth + attachUser
  auth.test.ts                 # unit tests for token, hash, middleware
  middleware/
    rateLimit.ts               # tiered express-rate-limit instances
  ocr/
    index.ts                   # provider singleton + runtime switching
    paddle.ts                  # ppu-paddle-ocr provider (default)
    tesseract.ts               # tesseract.js provider
    types.ts                   # OcrProvider interface
  utils/
    isbn.ts                    # ISBN validation/normalization shared across plugins
  routes/
    auth.ts                    # /api/auth/{login,logout,me,password}
    books.ts                   # CRUD + search + export + import (writes require auth)
    isbnOcr.ts                 # /api/isbn-ocr, extractISBN() exported for tests
    isbnOcr.test.ts            # extractISBN() tests
    clientError.ts             # /api/log/client — receives frontend error reports
    settings.ts                # /api/settings — per-user key/value store
    serverSettings.ts          # /api/server-settings — server-wide toggles (admin-only mutations)
    metadata.ts                # /api/metadata (unified lookups) + /api/plugins (meta)
    sources/
      legie.ts                 # /api/legie — series/slug-only endpoint for SeriesWizard
  services/
    plugins/
      index.ts                 # BUILTIN_PLUGINS, DEFAULT_ORDER, pluginsMeta()
      registry.ts              # registerPlugin, pluginsFor(capability)
      runner.ts                # runByISBN / runByTitle / runByAuthor / runBySeries / runByText / runCoverSearch
      runner.test.ts
      types.ts                 # BookSourcePlugin interface + PluginConfig
      coverCache.ts            # download/validate/store upstream covers, served at /api/covers
      sources/
        cbdb.ts + cbdb.test.ts
        databazeknih.ts + databazeknih.test.ts
        googleBooks.ts
        legie.ts + legie.test.ts
        nkp.ts
        obalkyKnih.ts
        openLibrary.ts
```

Pure parser functions are exported so Vitest can test them against minimal HTML fixtures without hitting the network. Route handlers stay in the same file as their parsers for locality.

### API endpoints

Auth — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password` (all except `/me` are explicit user actions; `/me` is a lightweight probe).

Book CRUD — `GET|POST /api/books`, `GET|PUT|DELETE /api/books/:id`, `GET /api/books/search?q=`, `DELETE /api/books`, `GET /api/export`, `POST /api/import`. **GETs on `/api/books` are public; all other book routes require auth.**

User settings — `GET /api/settings` returns `{ [key]: value }` for the current user; `PUT /api/settings/:key` upserts one key (body is the raw JSON value). **Both require auth.** Used by the frontend to sync plugin order across devices via [src/services/userSettings.ts](src/services/userSettings.ts) (500 ms per-key debounce).

Server settings — `GET /api/server-settings` returns `{ ocrProvider, ocrProviders }` (any authed user); `PUT /api/server-settings/ocr-provider` with `{ provider: "paddle" | "tesseract" }` flips the OCR backend at runtime (admin-only — `requireAdmin` inside the router). The server resets its OCR provider singleton so the next request picks up the change.

**Unified metadata** (replaces the per-provider scrapers/proxies) — **all require auth**:

- `GET /api/metadata?mode=isbn&q=9780…` — runs ISBN-capable plugins in parallel, then phase-2 title-only enrichers. Returns `{ book, sources }` where `book` is a merged `BookSearchResult` (or `null`) and `sources` lists each plugin's `{ id, status, ms, attempt }`.
- `GET /api/metadata?mode=title|author|series|text&q=…` — returns `{ results, sources }`.
- `GET /api/metadata?mode=cover&isbn=&title=&authors=a,b` — returns `{ covers, sources }` where `covers` is an array of cache-rewritten URLs (already downloaded + validated + served from `/api/covers`).
- `GET /api/plugins` — `{ plugins, defaultOrder }` used by the Settings UI to render names/capabilities.
- `GET /api/legie?slug=…` — series/slug-only endpoint retained for SeriesWizard's ordered-book-list flow. All other legie lookups go through `/api/metadata`.
- `POST /api/isbn-ocr` with base64 `{ image }` — Sharp preprocessing (greyscale + normalise + sharpen + threshold, also inverted) then hands both buffers to the configured OCR provider (PaddleOCR by default, Tesseract fallback). Tries normal + inverted in parallel. Returns `{ isbn, partial }`; pass `{ debug: true }` to also get `raw` + `debugImage` (base64 PNG).
- `POST /api/log/client` with `{ level?, message, stack?, url?, context? }` — frontend-error sink, **public** (unauthenticated errors on the login page still need to reach us). Logged via pino with `source: "client"`. The browser posts to this automatically via [src/services/errorReporter.ts](src/services/errorReporter.ts) (global `window.error` + `unhandledrejection` handlers, sendBeacon-first with fetch fallback, 5 s dedup window).

Static cover cache — `GET /api/covers/<sha1>.{jpg|png|webp}` is `express.static` over `~/.local/share/my-library/covers/` with `maxAge: 7d, immutable`. Served publicly; hashed filenames are unguessable. Metadata responses never contain upstream cover hosts — the runner pipes every `coverUrl` through [server/services/plugins/coverCache.ts](server/services/plugins/coverCache.ts), which validates host allowlist → `rateLimitedFetch` → sharp sanity check (≥20×20) → hashed rename, then rewrites the URL.

All outbound third-party requests go through [server/http.ts](server/http.ts)' per-host 1-second `rateLimitedFetch`. Custom `User-Agent` + `Accept-Language: cs-CZ` headers from `CZ_BROWSER_HEADERS` are sent to cbdb/legie/databazeknih. The frontend never talks to metadata providers directly — routing through the server lets us share a single rate-limit budget, hide user IPs, keep browser CORS/console clean, and cache covers same-origin.

### Rate limiting

Inbound limits (per IP, 1 minute windows) defined in [server/middleware/rateLimit.ts](server/middleware/rateLimit.ts):

| Limiter              | Limit   | Applied to                                                                                    |
| -------------------- | ------- | --------------------------------------------------------------------------------------------- |
| `globalLimiter`      | 300/min | `/api/*` (ceiling)                                                                            |
| `writeLimiter`       | 60/min  | `/api/books`, `/api/import`, `/api/settings`, `/api/server-settings` — skips GET/HEAD/OPTIONS |
| `scraperLimiter`     | 60/min  | `/api/metadata`, `/api/legie`                                                                 |
| `ocrLimiter`         | 20/min  | `/api/isbn-ocr`                                                                               |
| `clientErrorLimiter` | 30/min  | `/api/log/client`                                                                             |

`app.set("trust proxy", "loopback, linklocal, uniquelocal")` so the limiter sees the real client IP when fronted by a LAN reverse proxy.

### Authentication

Session cookie–based auth with a JWT payload:

- **Seeding:** on first boot, if the `users` table is empty, an `admin` / `admin` user is inserted. The server logs a warning instructing the operator to change it immediately via Settings.
- **Tokens:** [server/auth.ts](server/auth.ts) — `signToken`/`verifyToken` (jsonwebtoken, 30-day TTL), `hashPassword`/`verifyPassword` (bcryptjs, cost 10). The signing secret is read from `JWT_SECRET` if ≥16 chars, otherwise generated once and persisted to `~/.local/share/my-library/jwt-secret` (0600).
- **Cookie:** `mylib_session`, `httpOnly`, `sameSite=lax`, `secure` mirrors the request (so dev HTTP still works). 30-day `maxAge`.
- **Middleware:** `attachUser` runs on every `/api/*` request and populates `req.user` non-rejecting; `requireAuth` 401s when missing. Writes/scrapers/OCR are gated with `requireAuth` at router mount time (`server/index.ts`).
- **Login route:** [server/routes/auth.ts](server/routes/auth.ts) always runs `bcrypt.compare` (against a dummy hash if username missing) to avoid leaking user existence via timing. A tight login limiter (20/15min, skip successful requests) sits in front.
- **Frontend:** [src/store/useAuthStore.ts](src/store/useAuthStore.ts) (Zustand) wraps [src/services/auth.ts](src/services/auth.ts). `App.tsx` calls `loadMe()` on mount. [src/components/RequireAuth.tsx](src/components/RequireAuth.tsx) guards protected routes and redirects to `/login` preserving `from`. [src/services/apiFetch.ts](src/services/apiFetch.ts) wraps fetch: any 401 from `/api/*` clears local auth state so the next render bounces to login. The `/` route renders Library (public, read-only for guests); Stats, Settings, Scan, and BookDetail require auth.
- **Password change:** Settings embeds [src/components/PasswordChangeCard.tsx](src/components/PasswordChangeCard.tsx) which calls `POST /api/auth/password`; the server validates the current password, enforces `newPassword.length >= 4`, and rotates the cookie.

### Structured logging

[server/logger.ts](server/logger.ts) exports a shared pino instance; [server/index.ts](server/index.ts) wires `pino-http` request middleware. Log level defaults to `debug` in dev / `info` in prod; override with `LOG_LEVEL=warn` etc. Prefer `logger.warn({ source, ...context }, "msg")` over `console.*` in server code so logs stay grep-able and JSON-parseable in prod.

### Routing

`/scan` and `/login` are outside the shared `<Layout>` (full-screen, no nav chrome). All other routes (`/`, `/library`, `/stats`, `/settings`, `/book/:id`) are nested inside `<Layout>`. `/` renders `Library` (the app's landing page is the collection itself). Stats, Settings, Scan, and BookDetail are wrapped in `<RequireAuth>`. All pages are lazy-loaded via `React.lazy()`.

### Book metadata plugin system

All external book lookups go through a server-side plugin registry, not a hardcoded fallback chain. The browser only knows about `/api/metadata` and `/api/plugins`; every provider implementation lives in [server/services/plugins/](server/services/plugins/):

- **[types.ts](server/services/plugins/types.ts)** — `BookSourcePlugin` interface with optional `searchByISBN`, `searchByTitle`, `searchByAuthor`, `searchBySeries`, `searchByText`, `findCovers`. Each plugin implements only what it supports. `PluginConfig = { order, disabled }` threads user prefs into the runner.
- **[registry.ts](server/services/plugins/registry.ts)** — `registerPlugin`, `pluginsFor(capability)`.
- **[runner.ts](server/services/plugins/runner.ts)** — `runByISBN / runByTitle / runByAuthor / runBySeries / runByText / runCoverSearch`. Orchestrates parallel execution with per-plugin timeout. Merge strategy: for each field, take the value from the highest-priority candidate with a non-empty value. ISBN lookups run in two phases — phase 1 queries all ISBN-capable plugins; phase 2 uses the discovered title to run title-only enrichers (e.g. legie.info) whose results are then priority-sorted together.
- **[sources/](server/services/plugins/sources/)** — one file per provider: `cbdb`, `databazeknih`, `googleBooks`, `legie`, `nkp`, `obalkyKnih`, `openLibrary`.
- **[index.ts](server/services/plugins/index.ts)** — `BUILTIN_PLUGINS` default order (cbdb, databazeknih, nkp, googleBooks, openLibrary, legie, obalkyKnih), `DEFAULT_ORDER`, `pluginsMeta()` (used by `/api/plugins`).
- **[routes/metadata.ts](server/routes/metadata.ts)** — loads the caller's `plugins` entry from `user_settings`, invokes the runner with that `PluginConfig`, then rewrites cover URLs via `coverCache`.

Frontend side:

- **[src/services/plugins/registry.ts](src/services/plugins/registry.ts)** — `usePluginConfig` Zustand store for order + disabled IDs. Persisted per-user via `/api/settings` (key `plugins`) using [src/services/userSettings.ts](src/services/userSettings.ts). Writes only hit the server once the store is hydrated to avoid clobbering the server copy with defaults during the login transient.
- **[src/services/plugins/meta.ts](src/services/plugins/meta.ts)** — `usePluginsMeta()` fetches `/api/plugins` once, caches in-module. Used by Settings to render labels/capabilities.
- **[src/services/bookApi.ts](src/services/bookApi.ts)** — thin wrapper. `fetchByISBN / searchByTitle / searchByAuthor / searchBySeries / searchByText` each hit `/api/metadata?mode=...`.
- **[src/services/coverSearch.ts](src/services/coverSearch.ts)** — `searchCoverByISBN / searchAllCovers` hit `/api/metadata?mode=cover`; `downloadCover` base64-encodes for offline use; `searchByOCR` runs client-side tesseract.js on a captured cover image then feeds extracted text to `searchByText`.
- **[src/pages/Settings.tsx](src/pages/Settings.tsx)** — user-facing UI to reorder / enable / disable plugins and (for admins) pick the OCR provider.

Notes on individual sources:

- **NKP** (Aleph X-Server, 2-step `op=find` → `op=present`, OAI-MARC XML) does not provide covers.
- **legie** is title-based (no ISBN endpoint), so it implements `searchByTitle` + `findCovers` and runs in phase 2 during ISBN lookups.
- **All sources** run on the server — plugins only work when the backend is up.

### Scan page ([src/pages/Scan.tsx](src/pages/Scan.tsx))

Three modes: `barcode` | `cover` | `manual`.

- **barcode** — `@zxing/browser` `BrowserMultiFormatReader` (lazily imported inside `startBarcodeScanner()` to keep it out of the initial bundle); uses `barcodeVideoRef`.
- **cover** — `getUserMedia` live camera stream, captures a canvas frame → client-side Tesseract.js OCR (dynamically imported in `src/services/coverSearch.ts`) → `searchByText` (`/api/metadata?mode=text`); uses `coverVideoRef`. Separate from the server-side ISBN OCR used by `/api/isbn-ocr`.
- **manual** — ISBN text input + `ManualAddForm` modal for fully manual entry.

Stale-closure avoidance: scanner callbacks use `booksRef`, `isLoadingRef`, `torchRef` (refs kept in sync with state via `useEffect`).

### Bundle splitting

`vite.config.ts` `manualChunks`:

- `vendor-react` — react, react-dom, react-router-dom
- `vendor-zxing` — @zxing/browser, @zxing/library (~400 KB; only loaded when `/scan` is visited)
- `vendor-data` — zustand

### Service worker runtime caching (`vite.config.ts`)

- `googleapis.com/*` → NetworkFirst, 200 entries, 24 h
- `books.google.com/*` (covers) → CacheFirst, 500 entries, 7 d

### Theme

[src/utils/theme.tsx](src/utils/theme.tsx) — `ThemeProvider` syncs `useLibraryStore().theme` to the `dark` class on `<html>`. Initial value reads from `localStorage` (`"my-library-theme"`) then falls back to `prefers-color-scheme`.

### Vite dev proxy

`vite.config.ts` proxies `/api` → `http://localhost:3001` so the frontend and backend share one origin in dev.

## Testing

- **Runner:** Vitest 4 with `happy-dom` environment, config in [vitest.config.ts](vitest.config.ts).
- **Setup:** [src/test/setup.ts](src/test/setup.ts) stubs `window.matchMedia` (happy-dom doesn't implement it).
- **Coverage:** `@vitest/coverage-v8`, includes `src/**/*.{ts,tsx}` minus `main.tsx` / `*.test.ts` / `src/test/**`.
- **Conventions:** mock `fetch` with `vi.stubGlobal("fetch", vi.fn())` in `beforeEach`, reset in `afterEach`. Plugin tests (`server/services/plugins/**/*.test.ts`) parse local HTML fixtures — no network. The runner test (`runner.test.ts`) exercises `mergeResults` directly on synthesized `BookSearchResult`s.

## Patterns to follow

### Adding a new page

1. Create `src/pages/MyPage.tsx` with a default export.
2. Add a `lazy(() => import("@/pages/MyPage"))` entry in `src/App.tsx`.
3. Add the `<Route>` inside `<Layout>` (or outside if it needs full-screen, like `/scan`).
4. Add nav link in `src/components/Layout.tsx` (both desktop header and mobile bottom bar).

### Adding a new book metadata source

Book sources are **server-side** plugins under `server/services/plugins/sources/`. Create `myProvider.ts` that exports a `BookSourcePlugin`:

```ts
export const myProviderPlugin: BookSourcePlugin = {
  id: "my-provider", // stable — persisted in user_settings.plugins
  name: "My Provider",
  description: "One-liner shown in Settings",
  timeoutMs: 8000,
  async searchByISBN(isbn, signal) {
    /* return BookSearchResult | null */
  },
  async searchByTitle(title, signal) {
    /* return BookSearchResult[] */
  },
  async findCovers({ isbn, title }, signal) {
    /* return string[] */
  },
  // searchByAuthor / searchBySeries / searchByText are optional too
};
```

Implement only the capabilities your provider supports. Register it in `server/services/plugins/index.ts` `BUILTIN_PLUGINS` (order there is the default priority; users override via Settings). Use `coverUrl: ""` when no image is available — the UI handles empty covers with the BookOpen placeholder. Outbound requests must go through `rateLimitedFetch` from [server/http.ts](server/http.ts) to share the per-host budget. Return upstream cover URLs as-is; `routes/metadata.ts` funnels them through `coverCache` before the browser ever sees them.

The runner in `server/services/plugins/runner.ts` handles timeouts, parallelism, and merging: for each field, the highest-priority source with a non-empty value wins. Title-only plugins (no `searchByISBN`) run in a second phase during ISBN lookups, using the title discovered by phase 1 — this is how legie.info enriches bibliographic data with ratings and covers.

### Camera / MediaStream cleanup

Any component that opens a `getUserMedia` stream must:

- Store the stream in a `useRef`
- Stop all tracks explicitly: `stream.getTracks().forEach(t => t.stop())`
- Set `videoElement.srcObject = null`

The `Scan.tsx` page has two separate streams (`barcodeVideoRef`/`coverVideoRef`) — keep them independent; do not share a stream between modes.

### Stale closures in scanner callbacks

`@zxing/browser` callbacks fire outside React's render cycle. Access mutable state through refs (`booksRef`, `isLoadingRef`, `torchRef`), not state variables. Keep refs in sync via `useEffect`.

## Key constraints

- **No API keys** — all external data sources must be key-free. Google Books and Open Library are unauthenticated. NKP Aleph is a public library catalog.
- **`@zxing/library`** exports `NotFoundException`; `@zxing/browser` does not — import it from `@zxing/library`.
- **`vite.config.ts` uses ESM** (`"type": "module"` in package.json) — `__dirname` is not available; use `fileURLToPath(import.meta.url)` + `dirname()`.
- **Tailwind `darkMode: "class"`** — dark mode requires the `dark` class on `<html>`, managed by `ThemeProvider` in `src/utils/theme.tsx`. Do not use `prefers-color-scheme` media queries directly in components.
- **ZXing is ~400 KB** — keep it lazily imported inside `startBarcodeScanner()`, never at module top-level, to preserve the code-split boundary.
- **`coverBase64`** stores covers as base64 for offline access. Always call `fetchImageAsBase64(coverUrl)` when adding a book and persist the result — don't rely on `coverUrl` alone being available offline.
- **Frontend never hits third-party metadata providers directly.** Route every metadata call through `/api/metadata` (or `/api/legie` for SeriesWizard) so rate limits, CORS handling, and cover caching stay centralised.
