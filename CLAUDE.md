# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also [AGENT.md](./AGENT.md) for agent workflow patterns, common pitfalls, and constraints.

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
npx tsc --noEmit     # type-check only

npm run test         # vitest (watch mode)
npm run test:run     # vitest one-shot
npm run test:coverage  # vitest with v8 coverage
```

No linter is configured.

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
- **tesseract.js** for server-side ISBN OCR
- **pino + pino-http** for structured logging (pretty-printed in dev, JSON in prod; `LOG_LEVEL` env var)
- **express-rate-limit** tiered per route group (see Rate limiting below)
- **bcryptjs + jsonwebtoken + cookie-parser** for authentication (JWT in an httpOnly cookie; see Authentication below)
- **HTTPS** if `cert.pem` + `key.pem` are present in `~/.local/share/my-library/` (alongside the DB so they survive rsync deploys), HTTP otherwise

### Path alias

`@/` maps to `./src/` (configured in `vite.config.ts`, `tsconfig.json`, and `vitest.config.ts`).

### Storage

**SQLite** database at `~/.local/share/my-library/library.db` (`process.env.HOME` + `.local/share/my-library/`). Tables:

- **`books`** — schema in [server/db.ts](server/db.ts) mirrors the [Book](src/types/book.ts#L1-L21) interface, with `authors`/`genres` stored as JSON strings and `isRead` as 0/1.
- **`users`** — `id`, `username` (unique), `passwordHash` (bcrypt), `role`, timestamps. Admin is seeded on first boot (see Authentication).
- **`user_settings`** — `(user_id, key)` primary key, `value` is a JSON blob. Per-user key/value store for preferences that should sync across devices (currently just plugin order/disabled; extensible without new migrations). Cascades on user delete.

On startup the server copies `library.db` to `~/.local/share/my-library/backups/library-YYYY-MM-DD.db` (idempotent — one backup per calendar day). The JWT signing secret lives beside the DB at `~/.local/share/my-library/jwt-secret` (0600); override via `JWT_SECRET` env var.

### Data flow

1. App load → `App.tsx` calls `useLibraryStore().loadBooks()` → `GET /api/books` → populates Zustand `books` array.
2. All subsequent reads come from the in-memory Zustand array (no re-querying the API).
3. Writes are optimistic: Zustand updates immediately, `src/db/database.ts` sends the HTTP request, the server persists to SQLite.
4. Cover images are fetched as base64 via `src/services/imageCache.ts` and stored in `coverBase64` so they work offline. `coverUrl` is kept for re-fetch scenarios.

### Server layout

Routes are split into Express routers that mirror the frontend plugin layout:

```
server/
  index.ts                     # app setup, HTTPS, router mounting
  db.ts                        # SQLite (better-sqlite3) read/write helpers (books + users)
  http.ts                      # rateLimitedFetch + CZ_BROWSER_HEADERS (shared outbound)
  logger.ts                    # pino instance (pretty in dev, JSON in prod)
  auth.ts                      # JWT sign/verify, bcrypt hash/verify, requireAuth + attachUser
  auth.test.ts                 # unit tests for token, hash, middleware
  middleware/
    rateLimit.ts               # tiered express-rate-limit instances
  routes/
    auth.ts                    # /api/auth/{login,logout,me,password}
    books.ts                   # CRUD + search + export + import (writes require auth)
    isbnOcr.ts                 # /api/isbn-ocr, extractISBN() exported for tests
    clientError.ts             # /api/log/client — receives frontend error reports
    settings.ts                # /api/settings — per-user key/value store
    sources/
      cbdb.ts                  # /api/cbdb — parseCbdbBookPage, parseCbdbSearchLinks
      legie.ts                 # /api/legie + /api/legie/serie — parseLegieBookPage, parseLegieEditions, …
      databazeknih.ts          # /api/databazeknih — parseDatabazeknihBookPage, parseDatabazeknihSearchLinks
      googleBooks.ts           # /api/googleBooks — transparent proxy (rate-limited, auth-gated)
      openLibrary.ts           # /api/openLibrary — transparent proxy
      nkp.ts                   # /api/nkp — transparent proxy to aleph.nkp.cz X-Server
      obalkyKnih.ts            # /api/obalkyKnih — transparent proxy
      cbdb.test.ts             # parser unit tests (HTML fixtures)
      legie.test.ts            # parser unit tests (HTML fixtures)
      databazeknih.test.ts     # parser unit tests (HTML fixtures)
    isbnOcr.test.ts            # extractISBN() tests
```

Pure parser functions are exported so Vitest can test them against minimal HTML fixtures without hitting the network. Route handlers stay in the same file as their parsers for locality.

### API endpoints

Auth — `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/password` (all except `/me` are explicit user actions; `/me` is a lightweight probe).

Book CRUD — `GET|POST /api/books`, `GET|PUT|DELETE /api/books/:id`, `GET /api/books/search?q=`, `DELETE /api/books`, `GET /api/export`, `POST /api/import`. **GETs on `/api/books` are public; all other book routes require auth.**

User settings — `GET /api/settings` returns `{ [key]: value }` for the current user; `PUT /api/settings/:key` upserts one key (body is the raw JSON value). **Both require auth.** Used by the frontend to sync plugin order across devices via [src/services/userSettings.ts](src/services/userSettings.ts) (500 ms per-key debounce).

Third-party proxies (avoid CORS and bot-detection from the browser) — **all require auth**:

- `GET /api/cbdb?isbn=` or `?q=` — scrapes cbdb.cz, returns a parsed book record.
- `GET /api/legie?title=` | `?isbn=` | `?slug=` — scrapes legie.info (book info + edition covers). Returns `{ ...book, editions, coverUrls }`.
- `GET /api/legie/serie?slug=` — scrapes a series page, returns ordered book list.
- `GET /api/databazeknih?isbn=` or `?q=` — scrapes databazeknih.cz. The site's `/search` endpoint 302s straight to `/prehled-knihy/...` on unique hits (e.g. ISBNs), so one fetch handles the common case; otherwise falls back to picking the top search result. Rating is normalized from the site's 0–5 scale to 0–100.
- `GET /api/googleBooks?q=&maxResults=` — transparent proxy for `www.googleapis.com/books/v1/volumes`. Response body forwarded as-is; parsing stays in the frontend plugin.
- `GET /api/openLibrary?bibkeys=&format=&jscmd=` — transparent proxy for `openlibrary.org/api/books`.
- `GET /api/nkp?op=find|present&…` — transparent proxy for `aleph.nkp.cz/X`. Allowed params are `op, request, base, set_number, set_entry, format`; anything else is dropped.
- `GET /api/obalkyKnih?isbn=&keywords=` — transparent proxy for `www.obalkyknih.cz/api/books` (cover lookup).
- `POST /api/isbn-ocr` with base64 `{ image }` — Tesseract OCR tuned for ISBN digits (numeric whitelist, sparse-text PSM). Tries normal + inverted in parallel. Returns `{ isbn, partial }`.
- `POST /api/log/client` with `{ level?, message, stack?, url?, context? }` — frontend-error sink, **public** (unauthenticated errors on the login page still need to reach us). Logged via pino with `source: "client"`. The browser posts to this automatically via [src/services/errorReporter.ts](src/services/errorReporter.ts) (global `window.error` + `unhandledrejection` handlers, sendBeacon-first with fetch fallback, 5 s dedup window).

All third-party requests (scrapers + transparent proxies) go through [server/http.ts](server/http.ts)' per-host 1-second `rateLimitedFetch` to stay polite. Custom `User-Agent` + `Accept-Language: cs-CZ` headers from `CZ_BROWSER_HEADERS` are sent to cbdb/legie/databazeknih. The frontend never talks to metadata providers directly — routing through the server lets us share a single rate-limit budget, hide user IPs, and keeps browser CORS/console clean.

### Rate limiting

Inbound limits (per IP, 1 minute windows) defined in [server/middleware/rateLimit.ts](server/middleware/rateLimit.ts):

| Limiter              | Limit   | Applied to                                                                                                            |
| -------------------- | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `globalLimiter`      | 300/min | `/api/*` (ceiling)                                                                                                    |
| `writeLimiter`       | 60/min  | `/api/books`, `/api/import` — skips GET/HEAD/OPTIONS                                                                  |
| `scraperLimiter`     | 60/min  | `/api/cbdb`, `/api/legie`, `/api/databazeknih`, `/api/googleBooks`, `/api/openLibrary`, `/api/nkp`, `/api/obalkyKnih` |
| `ocrLimiter`         | 20/min  | `/api/isbn-ocr`                                                                                                       |
| `clientErrorLimiter` | 30/min  | `/api/log/client`                                                                                                     |

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

All external book lookups go through a plugin registry, not a hardcoded fallback chain. See [src/services/plugins/](src/services/plugins/):

- **[types.ts](src/services/plugins/types.ts)** — `BookSourcePlugin` interface with optional `searchByISBN`, `searchByTitle`, `searchByAuthor`, `searchBySeries`, `searchByText`, `findCovers`. Each plugin implements only what it supports.
- **[registry.ts](src/services/plugins/registry.ts)** — `registerPlugin`, `pluginsFor(capability)`, plus a Zustand store (`usePluginConfig`) holding user-defined order + disabled IDs. Persisted per-user via `/api/settings` (key `plugins`), so order syncs across devices. Writes only hit the server once the store is hydrated from `/api/settings` to avoid clobbering the server copy with defaults during the login transient.
- **[runner.ts](src/services/plugins/runner.ts)** — orchestrates parallel execution with per-plugin timeout. Merge strategy: for each field, take the value from the highest-priority candidate with a non-empty value. ISBN lookups run in two phases — phase 1 queries all ISBN-capable plugins; phase 2 uses the discovered title to run title-only enrichers (e.g. legie.info) whose results are then priority-sorted together.
- **[sources/](src/services/plugins/sources/)** — one file per provider: `googleBooks`, `openLibrary`, `nkp`, `cbdb`, `databazeknih`, `legie`, `obalkyKnih`.
- **[index.ts](src/services/plugins/index.ts)** — `BUILTIN_PLUGINS` default order (cbdb, databazeknih, nkp, googleBooks, openLibrary, legie, obalkyKnih) and `registerBuiltinPlugins()`, called once at app startup from `App.tsx`.
- **[src/pages/Settings.tsx](src/pages/Settings.tsx)** — user-facing UI to reorder / enable / disable plugins.

[src/services/bookApi.ts](src/services/bookApi.ts) and [src/services/coverSearch.ts](src/services/coverSearch.ts) are now thin wrappers that delegate to the runner. The public functions (`fetchByISBN`, `searchByTitle`, `searchByText`, `searchAllCovers`, etc.) are unchanged, so consumers don't need to know about plugins.

Notes on individual sources:

- **NKP** (Aleph X-Server, 2-step `op=find` → `op=present`, OAI-MARC XML parsed with browser `DOMParser`) does not provide covers.
- **All sources** go through the local server proxy (either a parsing scraper for cbdb/legie/databazeknih or a transparent proxy for googleBooks/openLibrary/nkp/obalkyKnih), so they only work when the backend is running.
- **legie** is title-based (no ISBN endpoint), so it implements `searchByTitle` + `findCovers` and runs in phase 2 during ISBN lookups.

### Scan page ([src/pages/Scan.tsx](src/pages/Scan.tsx))

Three modes: `barcode` | `cover` | `manual`.

- **barcode** — `@zxing/browser` `BrowserMultiFormatReader` (lazily imported inside `startBarcodeScanner()` to keep it out of the initial bundle); uses `barcodeVideoRef`.
- **cover** — `getUserMedia` live camera stream, captures a canvas frame → Tesseract.js OCR (dynamically imported in `src/services/coverSearch.ts`) → `searchByText`; uses `coverVideoRef`.
- **manual** — ISBN text input + `ManualAddForm` modal for fully manual entry.

Stale-closure avoidance: scanner callbacks use `booksRef`, `isLoadingRef`, `torchRef` (refs kept in sync with state via `useEffect`).

### Bundle splitting

`vite.config.ts` `manualChunks`:

- `vendor-react` — react, react-dom, react-router-dom
- `vendor-zxing` — @zxing/browser, @zxing/library (~400 KB; only loaded when `/scan` is visited)
- `vendor-data` — dexie, zustand (`dexie` is vestigial — see Storage note above)

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
- **Conventions:** mock `fetch` with `vi.stubGlobal("fetch", vi.fn())` in `beforeEach`, reset in `afterEach`. When testing the plugin runner, also reset `usePluginConfig` state (e.g. disable all but one plugin) so tests aren't coupled to the default priority order.
