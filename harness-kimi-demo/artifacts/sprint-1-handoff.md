# Sprint 1 Handoff

## What Was Built

- **`src/App.tsx`** — Root shell that composes the header, sticky filter bar, responsive bookmark grid, footer, and add/edit modal. Uses local React state initialized from `mockBookmarks`; all CRUD operations are local (no API calls).
- **`src/components/BookmarkCard.tsx`** — Reusable card displaying bookmark title, hostname (as mono text), favicon thumbnail via Google S2 favicon service with a fallback SVG, 2-line summary, clickable pill-shaped tag chips, relative saved date, and local edit/delete actions.
- **`src/components/FilterBar.tsx`** — Sticky top bar with search input (with inline clear button), result counter, horizontally scrollable tag cloud, and a "Clear all" control.
- **`src/data/mockBookmarks.ts`** — Mock data module exporting 26 diverse bookmarks with 12 unique tags. Schema mirrors the planned REST API resource: `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`.
- **`src/hooks/useBookmarkFilter.ts`** — Centralized filter state managing tag selection (OR logic) and search substring matching against title or tag names.
- **`src/main.tsx`** — Simplified entry point that renders `<App />` directly; no router, no auth provider, no backend dependency.
- **`src/index.css`** — Tailwind v4 setup with custom dark scrollbar, Inter + JetBrains Mono fonts, and slate-950 background.

## How to Run

```bash
cd project
npm install
npm run dev
# Open http://localhost:5173
```

To build for production:

```bash
cd project
npm run build
```

## Known Limitations

- **No backend** — All data is in-memory mock data. Refreshing the page resets any additions, edits, or deletions.
- **No persistence** — Local state only; no localStorage or API sync.
- **Future-sprint UI remains** — `BookmarkModal` still references `api/client` types for its payload shape, and `src/api/client.ts` retains the full API surface for later sprints. The app never invokes those functions in Sprint 1.
- **Favicon fetch** — Card thumbnails are fetched from Google's public favicon service; they require network but are not part of the application backend.

## Self-Evaluation Against Contract

| # | Criterion | Status |
|---|-----------|--------|
| 1 | The application renders a responsive grid of bookmark cards. | ✅ Verified at 375 px (1 col), 768 px (2 col), and 1440 px (3–4 col). |
| 2 | Each card displays the bookmark title, hostname, a favicon/thumbnail placeholder, the relative saved date, and clickable tag chips. | ✅ Visually confirmed on multiple cards; tags are pill-shaped with active/hover states. |
| 3 | The mock data module contains ≥24 bookmarks and 8–12 unique tags, using the schema `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. | ✅ 26 bookmarks, 12 unique tags, all records include every required field. |
| 4 | Clicking a tag chip toggles its selected state; the grid updates in real time to show only bookmarks matching **any** selected tag (OR logic). | ✅ Tested with "frontend" + "backend"; grid refreshed instantly with OR-union results. |
| 5 | The search input filters the grid by substring match against the bookmark title **or** tag name. | ✅ Searching "react" returned React Documentation and Next.js cards. |
| 6 | Active filters (selected tags and search text) are visually highlighted, and a single "Clear all" action resets them. | ✅ Active tags show indigo styling; "Clear all" restored the full 26-bookmark list. |
| 7 | The demo loads and runs without any backend, API, or database dependencies. | ✅ Zero outbound API calls observed; app renders correctly offline. |
