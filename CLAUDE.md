# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also [AGENT.md](./AGENT.md) for agent workflow patterns, common pitfalls, and constraints.

## Deployment

**Dev server:** `ssh havran@192.168.1.141`

After changes, sync the built output:
```bash
rsync -avz --delete dist/ havran@192.168.1.141:~/my-library/
```

## Commands

```bash
npm run dev       # start Vite dev server (hot reload)
npm run build     # tsc type-check + Vite production build
npm run preview   # serve the production build locally
npx tsc --noEmit  # type-check only, no build
```

There are no tests or linting scripts configured.

## Architecture

### Stack
- **Vite 6 + React 19** — SPA, no SSR
- **React Router v7** — client-side routing (`BrowserRouter`)
- **Tailwind CSS v3** — `darkMode: "class"` (toggled via `document.documentElement.classList`)
- **Dexie v4** — IndexedDB wrapper; single database `MyLibraryDB`, one `books` table
- **Zustand v5** — global state; single store `useLibraryStore`
- **vite-plugin-pwa + Workbox** — service worker, offline support, installable PWA

### Path alias
`@/` maps to `./src/` (configured in both `vite.config.ts` and `tsconfig.json`).

### Data flow
1. On app load, `App.tsx` calls `useLibraryStore().loadBooks()` which reads all books from IndexedDB into the Zustand store.
2. All subsequent reads come from the in-memory Zustand `books` array (no re-querying Dexie).
3. Writes hit Dexie first, then update the Zustand state optimistically — keeping store and DB in sync.
4. Cover images are fetched as base64 via `src/services/imageCache.ts` and stored in the `coverBase64` field so they work offline.

### Routing
`/scan` is outside the shared `<Layout>` (full-screen, no nav chrome). All other routes (`/`, `/library`, `/stats`, `/book/:id`) are nested inside `<Layout>`. All pages are lazy-loaded via `React.lazy()`.

### Book lookup — fallback chain
`src/services/bookApi.ts` — `fetchByISBN(isbn)`:
1. **Google Books API** (`googleapis.com/books/v1/volumes`)
2. **Open Library** (`openlibrary.org/api/books`)
3. **NKP Czech National Library** — Aleph X-Server (`aleph.nkp.cz/X`), 2-step: `op=find` → `op=present`, returns OAI-MARC XML parsed with browser `DOMParser`; NKP does not provide cover images so `coverUrl` is `""` for NKP results.

### Scan page (`src/pages/Scan.tsx`)
Three modes: `barcode` | `cover` | `manual`.
- **barcode** — `@zxing/browser` `BrowserMultiFormatReader` (lazily imported inside `startBarcodeScanner()` to keep it out of the initial bundle); uses `barcodeVideoRef`.
- **cover** — `getUserMedia` live camera stream, captures a canvas frame → Tesseract.js OCR (dynamically imported in `src/services/coverSearch.ts`) → `searchByText`; uses `coverVideoRef`.
- **manual** — ISBN text input + `ManualAddForm` modal for fully manual entry.

Stale-closure avoidance: scanner callbacks use `booksRef`, `isLoadingRef`, `torchRef` (refs kept in sync with state via `useEffect`).

### Bundle splitting
`vite.config.ts` `manualChunks`:
- `vendor-react` — react, react-dom, react-router-dom
- `vendor-zxing` — @zxing/browser, @zxing/library (~400 KB; only loaded when `/scan` is visited)
- `vendor-data` — dexie, zustand

### Theme
`src/utils/theme.tsx` — `ThemeProvider` syncs `useLibraryStore().theme` to the `dark` class on `<html>`. Initial value reads from `localStorage` (`"my-library-theme"`) then falls back to `prefers-color-scheme`.
