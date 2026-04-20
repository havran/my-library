# AGENT.md

Agent-specific guidelines for working in this repository. Read alongside [CLAUDE.md](./CLAUDE.md).

## Workflow

Always run `npx tsc --noEmit` after any code change before considering a task done. Only run the full `npm run build` when verifying bundle output or PWA generation is necessary.

## Patterns to follow

### Adding a new page

1. Create `src/pages/MyPage.tsx` with a default export.
2. Add a `lazy(() => import("@/pages/MyPage"))` entry in `src/App.tsx`.
3. Add the `<Route>` inside `<Layout>` (or outside if it needs full-screen, like `/scan`).
4. Add nav link in `src/components/Layout.tsx` (both desktop header and mobile bottom bar).

### Adding a new book metadata source

Book sources are plugins under `src/services/plugins/sources/`. Create `myProvider.ts` that exports a `BookSourcePlugin`:

```ts
export const myProviderPlugin: BookSourcePlugin = {
  id: "my-provider", // stable — used in persisted user config
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

Implement only the capabilities your provider supports. Register it in `src/services/plugins/index.ts` `BUILTIN_PLUGINS` (order there is the default priority; users override via Settings). Use `coverUrl: ""` when no image is available — the UI handles empty covers with the BookOpen placeholder.

The runner in `src/services/plugins/runner.ts` handles timeouts, parallelism, and merging: for each field, the highest-priority source with a non-empty value wins. Title-only plugins (no `searchByISBN`) run in a second phase during ISBN lookups, using the title discovered by phase 1 — this is how legie.info enriches bibliographic data with ratings and covers.

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
- **Dexie schema changes** require a version bump: `db.version(2).stores({...})`. Never alter the version 1 `.stores()` call.
- **`coverBase64`** stores covers as base64 for offline access. Always call `fetchImageAsBase64(coverUrl)` when adding a book and persist the result — don't rely on `coverUrl` alone being available offline.
