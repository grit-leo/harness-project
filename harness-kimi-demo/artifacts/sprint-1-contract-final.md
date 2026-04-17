# Sprint 1 Contract — Interactive Frontend Demo

## Scope
We will build a single-page interactive frontend demo for Lumina using React 18, Vite, TypeScript, and Tailwind CSS. The deliverable consists of the following components, pages, and files:

- **`src/App.tsx`** — Root application shell that composes the layout, filter bar, and bookmark grid.
- **`src/components/BookmarkCard.tsx`** — Reusable card component displaying: bookmark title, hostname, favicon/thumbnail placeholder, relative saved date, and associated tag chips.
- **`src/components/FilterBar.tsx`** — Sticky top bar containing: a horizontally scrollable tag cloud, a search input, and a "Clear filters" control.
- **`src/data/mockBookmarks.ts`** — Mock data module exporting at least 24 diverse bookmarks with 8–12 unique tags. The schema mirrors the planned REST API resource shape (`id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`).
- **`src/hooks/useBookmarkFilter.ts`** *(or equivalent inline state)* — Centralized filter state managing tag selection (OR logic) and search substring matching.
- **Responsive CSS layout** — A bookmark grid that adapts gracefully from mobile (1 column) to tablet (2 columns) to desktop (3–4 columns) with a minimum card width of 320 px and a 24 px gap.

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | The application renders a responsive grid of bookmark cards. | Resize the browser viewport; the grid must display 1 column on mobile, 2 on tablet, and 3–4 on desktop without horizontal overflow. |
| 2 | Each card displays the bookmark title, hostname, a favicon/thumbnail placeholder, the relative saved date, and clickable tag chips. | Visually inspect at least three cards; confirm all listed elements are present and tags are rendered as pill-shaped chips. |
| 3 | The mock data module contains ≥24 bookmarks and 8–12 unique tags, using the schema `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. | Open `src/data/mockBookmarks.ts` and count the records and distinct tags; confirm every record includes all required fields with correct types. |
| 4 | Clicking a tag chip toggles its selected state; the grid updates in real time to show only bookmarks matching **any** selected tag (OR logic). | Click two different tag chips in the UI; verify the grid refreshes instantly and shows bookmarks that have at least one of the selected tags. |
| 5 | The search input filters the grid by substring match against the bookmark title **or** tag name. | Type a known substring into the search box; confirm the grid displays only bookmarks whose title or tag list includes that substring. |
| 6 | Active filters (selected tags and search text) are visually highlighted, and a single "Clear all" action resets them. | Select one or more tags and enter search text; confirm active states are styled distinctly, then click the clear control and verify the grid returns to the full unfiltered list. |
| 7 | The demo loads and runs without any backend, API, or database dependencies. | Start the dev server (`npm run dev` or `pnpm dev`), open the app in a browser, and confirm the Network tab shows **zero** outbound API calls and the page renders correctly offline. |

## Out of Scope
- Backend / API / database — deferred to Sprint 2
- AI features — deferred to Sprint 3
- User authentication, persistence, import/export, browser extension, collaboration, or smart collections

## Dependencies
- None (this is Sprint 1)

## Tech Stack
- React 18 + Vite + TypeScript + Tailwind CSS
- All data from a mock module (no network calls)
