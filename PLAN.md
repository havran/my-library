# PLAN.md — Improvement Roadmap

Recommendations for improving workflow, visuals/UX, and monetization of My Library.

---

## 1. Workflow

### High-impact, low-effort — ✅ Done (2026-04-19)

- ✅ **Add ESLint + Prettier.** Flat ESLint 9 config with `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, and `eslint-config-prettier`. Prettier 3 with `printWidth: 100`, `trailingComma: "all"`. Scripts: `lint`, `lint:fix`, `format`, `format:check`.
- ✅ **Set up CI.** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs `typecheck`, `lint`, `format:check`, and `test:run` on PRs and pushes to main/master using Node 22.
- ✅ **Wire a pre-commit hook.** `husky` + `lint-staged`: staged `*.{ts,tsx}` run through `eslint --fix` + `prettier --write`; `*.{json,md,css,html}` through `prettier --write`.
- ✅ **Automate deployment.** `npm run deploy` builds and rsyncs both `dist/` and `server/` to the dev server in one step.
- ✅ **Delete `dexie`.** Removed from `package.json` dependencies and from the `vendor-data` chunk in [vite.config.ts](vite.config.ts).

### Medium-effort

- **Error tracking.** Sentry free tier or self-hosted GlitchTip. The plugin runner swallows errors with `console.warn` — in production you'll never know which source is failing. _(Partially done 2026-04-19: frontend errors now POST to `/api/log/client` via [errorReporter.ts](src/services/errorReporter.ts) + global `window.error`/`unhandledrejection` handlers. Sentry would add grouping, stack symbolication, retention.)_
- ✅ **Structured server logs** (2026-04-19). Added pino + pino-http — request logs, source-tagged scraper errors, pretty in dev / JSON in prod, `LOG_LEVEL` env var.
- ✅ **Server-side rate limiting on our own endpoints** (2026-04-19). `express-rate-limit` tiered per route group (global 300, writes 60, scrapers 60, OCR 20, client errors 30) — see [server/middleware/rateLimit.ts](server/middleware/rateLimit.ts).
- **DB migrations story.** `server/db.ts` uses `CREATE TABLE IF NOT EXISTS`. The moment a column is added, it'll be a manual `ALTER TABLE` in prod. A tiny migrations table + versioned SQL files prevents silent drift between dev and the dev-server SQLite file.
- **Backup improvement.** Daily full copy at startup is nice; rotate to keep last N days and optionally push to S3/Backblaze B2.

---

## 2. Visuals & UX

### Quick wins

- **Skeleton loaders** instead of spinners on Home/Library/BookDetail. The app already has `coverBase64` offline — initial render should feel instant.
- **Inline "mark as read" on BookCard.** Today toggling `isRead` requires navigating to detail → scroll → tap → save. A long-press or corner tap on the card removes ~4 interactions per book.
- **Bulk selection** in Library (select multiple → delete / tag / mark read). Long-press to enter "select mode" is the standard mobile pattern.
- **Delete button on hover-only** ([src/pages/Library.tsx:63-70](src/pages/Library.tsx#L63-L70)) doesn't work on touch devices. Use long-press or swipe-to-reveal on mobile.
- **Keyboard shortcuts** (`/` focus search, `g l` go library, `s` scan) for desktop power users. `tinykeys` is tiny.
- **Onboarding / first-run empty state.** The Home empty state is helpful but lacks a demo book and a "Import your Goodreads export" CTA. A Goodreads CSV importer is a huge retention lever — people have years of data they don't want to re-enter.

### Bigger additions

- **Rich filtering** on Library: by author / genre / series / rating / read state. The data model supports it; the UI doesn't expose it.
- **Series view.** The `/api/legie/serie` endpoint is already there. Surface a "Complete the series" CTA on BookDetail (e.g. "You have books 1, 3 of Dune — missing 2, 4, 5"). This is a killer feature nobody else has for Czech readers.
- **Reading timeline / streaks** on Stats. Currently only static totals + a pie chart. Add a yearly calendar heatmap of `addedAt` / `finishedAt` (would require adding `finishedAt` to the Book model).
- **Virtualize the Library grid** once a user crosses ~500 books. `react-window` or `@tanstack/react-virtual`. Not urgent, free future-proofing.
- **Drag-to-reorder** in Settings plugin list. Arrows work but feel clunky. `@dnd-kit/sortable` is ~15KB and the right tool.
- **Per-plugin "test connection"** button in Settings — reveals which scrapers are currently broken (legie/cbdb break periodically as the sites change HTML).
- **Animated page transitions** (`framer-motion` `layoutId` shared element from cover in grid → cover in detail). Small touch, huge perceived-polish upgrade.
- **Warmer dark-mode palette.** `bg-gray-950`/`bg-gray-900` is fine but everything reads the same weight; accent greens/blues get muddy. Consider book-spine tones for dark mode.

---

## 3. Monetization

The product's unique wedge is a **privacy-first, Czech/Slovak-aware book tracker**. Mass-market book apps (Goodreads, StoryGraph) don't cover Czech titles well because they don't scrape NKP/legie/cbdb. Monetization strategy should lean into that.

### Lowest friction — start here

- **Affiliate links.** Add "Buy on Knihobot / Martinus / Kosmas / Amazon" buttons on BookDetail. Knihobot and Martinus both have public affiliate programs; a single click-through can pay for monthly server costs. Zero UX cost if implemented as a subtle link.
- **Donations / "Buy Me a Coffee".** If the app goes public, a footer link. Won't fund anything but validates whether people care.

### Freemium SaaS — if pursuing real revenue

Two-tier model with a clear free/paid split:

- **Free:** local-only storage, unlimited books, all scanning, all plugins.
- **Paid (~€3–5/month or €30/year):**
  - End-to-end encrypted **cloud sync** across devices (the server is already there; add E2EE with a user-held key).
  - **Automated Goodreads / StoryGraph imports.**
  - **CSV / BibTeX export.**
  - **Collection sharing** — read-only public page with a subset of books (great for book clubs, bloggers).

Obsidian Sync is the reference model: privacy-respecting, per-user per-month.

The plugin architecture is a selling point here: _"Add your own metadata source"_ → paid users get server-side plugin hosting so they don't need to run a local backend.

### B2B / niche angles — higher ceiling, more work

- **Small-library SaaS.** Czech school libraries / kindergartens / church libraries run on spreadsheets. Rebrand as "Knihovna" with loan tracking (who borrowed what, due dates). €15–30/month per institution. The ISBN OCR + NKP integration is a real moat vs international competitors that can't read Czech MARC.
- **White-label for Czech bookstores.** A small bookstore could use the scanner + SQLite backend as a cheap POS/inventory alternative. One-time license fee or annual support contract.
- **Plugin marketplace** (longer term). Once third-party plugins exist, take a cut on paid ones (Goodreads sync, calibre integration, StoryGraph sync).

### Do not pursue

- **Ads** on a book-lover's app — kills the "personal library" vibe that's the differentiator.
- **Selling user data.** Privacy is a feature to be kept, not traded.

---

## Suggested sequencing

1. **This week:** ~~ESLint/Prettier, CI workflow, delete `dexie`~~ ✅, Sentry.
2. **Next:** Goodreads CSV importer + bulk selection + series-completion CTA (retention drivers).
3. **Then:** affiliate links on BookDetail (first revenue).
4. **If traction:** cloud sync as paid feature. Otherwise keep it as a weekend tool and take the affiliate pennies.
