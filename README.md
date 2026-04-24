# My Library

A personal book library — keep track of everything you own (or want), scan ISBN barcodes with your phone, and pull rich metadata from Czech and international sources. Built as an installable PWA so it works from the home-screen on mobile and offline once loaded.

## What it can do

- **Scan ISBNs** with the device camera (EAN-13 barcode reader) or point at the back cover and let OCR pick the ISBN off the printed number.
- **Pull metadata** from multiple sources in parallel — [cbdb.cz](https://cbdb.cz), [databazeknih.cz](https://www.databazeknih.cz), [legie.info](https://www.legie.info), the Czech National Library (NKP), Google Books, Open Library, and obalkyknih.cz. The highest-priority non-empty field wins, so Czech sources fill in things Google misses (and vice versa). Users can reorder or disable sources in Settings.
- **Cover search & picker** — fetch multiple cover candidates per book, pick the one you like, store it locally as base64 so it shows offline.
- **Search your collection** by title, author, genre, or ISBN. Filter by read/unread. Sort by date added, title, or author.
- **Series wizard** — given a legie.info series page, fetch the ordered book list and flag which volumes you're missing.
- **Stats** — counts, read progress, top authors/genres.
- **Multi-user** with password login. Reads are public (guest-browsable); writes are gated.
- **Export/import** the whole collection as JSON.
- **Installable** as a PWA (Chrome/Safari "Add to Home Screen"). Once installed the UI, book data, and covers all work offline.

## Stack at a glance

- React 19 + Vite 6 + Tailwind + Zustand on the frontend
- Express 5 + better-sqlite3 on the backend
- Pluggable ISBN OCR — PaddleOCR by default, Tesseract.js as fallback
- All data lives in `~/.local/share/my-library/library.db` with a daily backup alongside

See [AGENTS.md](./AGENTS.md) for the full architecture, API surface, plugin system, and deployment notes.

## Running it locally

### Requirements

- Node.js 24+ (see `.nvmrc` — `nvm use` picks it up)
- npm 10+
- A POSIX shell (Linux, macOS, or WSL on Windows)
- A modern browser with camera access for the scanner (Chrome, Safari, Edge). The dev server serves over HTTPS with a self-signed cert so `getUserMedia` works without extra flags — accept the browser warning the first time.

### Install

```bash
git clone <this repo>
cd my-library
nvm use            # optional, picks Node version from .nvmrc
npm install
```

### Dev server

```bash
npm run dev
```

That starts two processes concurrently:

- **Vite** on `https://localhost:5173` (frontend with hot reload)
- **Express API** on `https://localhost:3001` (SQLite + third-party proxies)

Open `https://localhost:5173`. The Vite proxy forwards `/api/*` to the backend, so the frontend and API share one origin.

First boot seeds an admin account: **username `admin` / password `admin`**. Change it immediately via Settings → Password.

### Production preview

```bash
npm run build
npm run preview       # serves the built bundle from the frontend side
# or:
npm run server        # Express serves the built SPA + /api on :3001
```

### Other useful scripts

```bash
npm run typecheck     # tsc --noEmit
npm run test:run      # vitest once
npm run lint          # ESLint
npm run format        # Prettier --write
```

## Data location

Everything user-generated (database, daily backups, cached cover images, JWT signing secret, optional TLS certs) lives under `~/.local/share/my-library/`:

```
~/.local/share/my-library/
  library.db                    # SQLite database
  backups/library-YYYY-MM-DD.db # daily rotating snapshots
  covers/<sha1>.{jpg,png,webp}  # downloaded cover cache
  jwt-secret                    # auto-generated on first boot
  cert.pem + key.pem            # optional; backend serves HTTPS when present
```

Deleting `library.db` resets the app. The daily backup makes that recoverable.

## Deployment

There's a one-command deploy (`npm run deploy`) that builds the frontend, rsyncs to a LAN host, and expects pm2 on the remote. The full recipe — first-time pm2 setup, logs, log rotation — lives in [AGENTS.md](./AGENTS.md#deployment).
