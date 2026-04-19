# Sprint 1 QA Report — Round 1

## Test Environment

- Frontend: [http://localhost:5173](http://localhost:5173) (reachable: **yes**)
- Backend: [http://localhost:8000](http://localhost:8000) (reachable: **yes** — /docs returned 200)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log

- `browser_navigate http://localhost:5173` → initial load / criterion #7
- `browser_snapshot` + `browser_take_screenshot` → criterion #1, #2
- `browser_resize 375x812` + `browser_take_screenshot` → criterion #1 (mobile)
- `browser_resize 768x1024` + `browser_take_screenshot` → criterion #1 (tablet)
- `browser_resize 1440x900` + `browser_take_screenshot` → criterion #1 (desktop)
- `browser_click "frontend" tag` + `browser_take_screenshot` → criterion #4
- `browser_click "backend" tag` + `browser_take_screenshot` → criterion #4 (OR logic)
- `browser_type "react"` into search + `browser_take_screenshot` → criterion #5
- `browser_type "ai"` into search + `browser_take_screenshot` + `browser_evaluate` → criterion #5
- `browser_click "Clear all"` + `browser_take_screenshot` → criterion #6
- `browser_click "docs" tag inside BookmarkCard` + `browser_take_screenshot` → criterion #4 (card-level tag click)
- `browser_type "xyznonexistent"` into search + `browser_take_screenshot` → criterion #6 (empty state)
- `browser_click "Clear all filters"` in empty state + `browser_take_screenshot` → criterion #6
- `browser_resize 1920x1080` + `browser_take_screenshot` → criterion #1 (wide desktop)
- `browser_network_requests` (static + non-static) → criterion #7
- `browser_console_messages` (error level) → zero errors throughout session
- `browser_close`

Screenshots saved:

- `artifacts/screenshots/sprint-1-initial-desktop.png`
- `artifacts/screenshots/sprint-1-mobile.png`
- `artifacts/screenshots/sprint-1-tablet.png`
- `artifacts/screenshots/sprint-1-desktop.png`
- `artifacts/screenshots/sprint-1-filter-frontend.png`
- `artifacts/screenshots/sprint-1-filter-frontend-backend.png`
- `artifacts/screenshots/sprint-1-search-react.png`
- `artifacts/screenshots/sprint-1-search-ai-tag.png`
- `artifacts/screenshots/sprint-1-cleared.png`
- `artifacts/screenshots/sprint-1-card-tag-click.png`
- `artifacts/screenshots/sprint-1-empty-state.png`
- `artifacts/screenshots/sprint-1-empty-state-cleared.png`
- `artifacts/screenshots/sprint-1-desktop-1920.png`

## Contract Criteria


| #   | Criterion                                                                                                                                               | Result   | Evidence (screenshot / console / network)                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The application renders a responsive grid of bookmark cards.                                                                                            | **PASS** | Mobile (375 px): 1 column (`sprint-1-mobile.png`). Tablet (768 px): 2 columns (`sprint-1-tablet.png`). Desktop (1440 px & 1920 px): 3 columns (`sprint-1-desktop.png`, `sprint-1-desktop-1920.png`). No horizontal overflow observed at any width. Grid CSS: `grid-cols-[repeat(auto-fill,minmax(320px,1fr))]` with `gap-6`.                                                                                            |
| 2   | Each card displays the bookmark title, hostname, a favicon/thumbnail placeholder, the relative saved date, and clickable tag chips.                     | **PASS** | Visually confirmed on 26 cards across all screenshots. Cards show: title (e.g., "React Documentation…"), hostname in mono font (e.g., `react.dev`), Google S2 favicon image with SVG fallback, relative date (e.g., "2y ago"), and pill-shaped tag chips (`sprint-1-desktop.png`).                                                                                                                                      |
| 3   | The mock data module contains ≥24 bookmarks and 8–12 unique tags, using the schema `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. | **PASS** | Source file `project/src/data/mockBookmarks.ts` contains 26 bookmarks and 12 unique tags (`ai`, `backend`, `database`, `design`, `devops`, `docs`, `frontend`, `learning`, `news`, `open-source`, `productivity`, `tools`). Every record includes all required fields with correct types verified by `npm run build` (TypeScript compiled successfully).                                                                |
| 4   | Clicking a tag chip toggles its selected state; the grid updates in real time to show only bookmarks matching **any** selected tag (OR logic).          | **PASS** | Clicked "frontend" → grid refreshed to 8/26 results (`sprint-1-filter-frontend.png`). Clicked "backend" while "frontend" active → grid refreshed to 12/26 results (`sprint-1-filter-frontend-backend.png`). Clicked "docs" tag inside a BookmarkCard → both "frontend" and "docs" became active, grid showed 9/26 results (`sprint-1-card-tag-click.png`). OR math verified: 8 (frontend) + 4 (docs) − 3 (overlap) = 9. |
| 5   | The search input filters the grid by substring match against the bookmark title **or** tag name.                                                        | **PASS** | Typed "react" → 2 results: React Documentation and Next.js (`sprint-1-search-react.png`). Typed "ai" → 6 results matching title substrings ("Tailwind", "Container", "Daily") or the "ai" tag (`sprint-1-search-ai-tag.png`). Verified via `browser_evaluate` that the filter logic matches `bookmark.title.toLowerCase().includes(query) || bookmark.tags.some(tag => tag.toLowerCase().includes(query))`.             |
| 6   | Active filters (selected tags and search text) are visually highlighted, and a single "Clear all" action resets them.                                   | **PASS** | Active tags display indigo border/background (`sprint-1-filter-frontend.png`, `sprint-1-card-tag-click.png`). Search text is visible in the input with an inline clear × button. Clicked "Clear all" in the filter bar → restored full 26-bookmark list (`sprint-1-cleared.png`). Empty state also provides a "Clear all filters" button that works (`sprint-1-empty-state-cleared.png`).                               |
| 7   | The demo loads and runs without any backend, API, or database dependencies.                                                                             | **PASS** | Network log captured with `browser_network_requests` (static=true) shows **zero** requests to `localhost:8000`. All network traffic is either Vite HMR/dev-server localhost:5173 assets, Google Fonts, or Google S2 favicon images. `browser_console_messages` returned 0 errors. Build passes with no backend imports invoked at runtime.                                                                              |


## Dimension Scores


| Dimension     | Score | Threshold | Pass?   |
| ------------- | ----- | --------- | ------- |
| Product Depth | 8/10  | 6/10      | **Yes** |
| Functionality | 9/10  | 7/10      | **Yes** |
| Visual Design | 7/10  | 5/10      | **Yes** |
| Code Quality  | 7/10  | 5/10      | **Yes** |


## Regression Check (prior sprints)


| Sprint | Flow Tested                  | Result | Evidence |
| ------ | ---------------------------- | ------ | -------- |
| N/A    | No prior sprints to regress. | —      | —        |


## Bugs Found

**No bugs found that fail any acceptance criterion.**

The following items were noted during testing but do **not** constitute contract failures:

1. **[NOTE-001]** Search substring "ai" matches titles containing "ai" as a substring (e.g., "Tailw**ai**nd", "Cont**ai**ner", "D**ai**ly") rather than whole-word matches. This is technically correct per the contract's "substring match" requirement, but may produce unexpected results for users searching short terms. Consider adding word-boundary awareness or a dedicated tag-exact-match mode in a future iteration.
2. **[NOTE-002]** Desktop viewport never reaches 4 columns because the grid is constrained by `max-w-7xl` (1280 px). With `minmax(320px, 1fr)` and a 24 px gap, 4 columns would require ≈1352 px of available width. The contract explicitly accepts "3–4 columns", so 3 columns is within spec. To enable 4 columns, either widen the container or reduce the gap.
3. **[NOTE-003]** `BookmarkCard.tsx` and `App.tsx` import TypeScript types from `src/api/client.ts` (a future-sprint API module). These are compile-time-only type imports; no runtime API calls are made. This is noted in the handoff as a known limitation and does not affect Sprint 1 behavior.

## Overall Verdict: **PASS**

## Feedback for Generator

All acceptance criteria are satisfied with concrete browser evidence. The implementation is solid, responsive, and visually polished. No actionable fixes are required for Sprint 1.

If you wish to address the noted items proactively:

- `project/src/hooks/useBookmarkFilter.ts`: Consider a word-boundary or exact-tag option for short search queries to improve UX.
- `project/src/App.tsx` line 167: Remove or widen `max-w-7xl` if 4-column desktop layout is desired.
- `project/src/components/BookmarkCard.tsx` line 1 & `project/src/App.tsx` line 7: Clean up the `api/client` type imports by duplicating the minimal `Bookmark` / `BookmarkCreate` interfaces into a Sprint-1-only types file if you want to eliminate the future-sprint dependency entirely.