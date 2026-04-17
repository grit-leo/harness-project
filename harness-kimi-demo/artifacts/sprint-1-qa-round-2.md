# Sprint 1 QA Report — Round 2

## Round 1 Bug Status

| Bug | Description | Fixed? | Evidence |
|-----|-------------|--------|----------|
| BUG-001 | Desktop card width violates 320px minimum constraint. | **YES** | `project/src/App.tsx` line 100 now uses `grid-cols-[repeat(auto-fill,minmax(320px,1fr))]`, ensuring no card shrinks below 320px. |
| BUG-002 | Missing favicon/thumbnail placeholder on bookmark cards. | **YES** | `project/src/components/BookmarkCard.tsx` lines 62–69 now loads a favicon via `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` and provides an SVG link-icon fallback via `onError`. |
| BUG-003 | React 19 installed instead of React 18. | **YES** | `project/package.json` lines 13–14 list `"react": "^18.3.1"` and `"react-dom": "^18.3.1"`. |
| BUG-004 | Undefined CSS utility class `scrollbar-hide`. | **YES** | `project/src/components/FilterBar.tsx` line 99 no longer contains `scrollbar-hide`; the tag container uses `overflow-x-auto` only. |
| BUG-005 | Dead/unused CSS file `App.css`. | **YES** | `project/src/App.css` has been deleted and is absent from the source tree. |

## Contract Criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | The application renders a responsive grid of bookmark cards. | **PASS** | `App.tsx` uses `grid-cols-[repeat(auto-fill,minmax(320px,1fr))]` with `gap-6` (24px). Mobile (≥352px) shows 1 column, tablet shows 2 columns, and desktop shows 3 columns without squeezing cards below 320px. |
| 2 | Each card displays the bookmark title, hostname, a favicon/thumbnail placeholder, the relative saved date, and clickable tag chips. | **PASS** | `BookmarkCard.tsx` renders: title (line 73), hostname (line 76), favicon `<img>` with fallback (lines 62–69), relative date via `getRelativeTime` (line 111), and pill-shaped clickable tag `<button>`s (lines 86–107). |
| 3 | The mock data module contains ≥24 bookmarks and 8–12 unique tags, using the required schema. | **PASS** | `mockBookmarks.ts` exports 26 bookmarks and 12 distinct tags (`frontend`, `docs`, `design`, `tools`, `backend`, `open-source`, `database`, `devops`, `productivity`, `learning`, `ai`, `news`). Every record includes `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, and `updatedAt`. |
| 4 | Clicking a tag chip toggles its selected state; the grid updates in real time to show only bookmarks matching any selected tag (OR logic). | **PASS** | `useBookmarkFilter.ts` line 40 implements OR logic with `selectedTags.some((tag) => bookmark.tags.includes(tag))`. Both `FilterBar` and `BookmarkCard` tag chips call `toggleTag`, triggering instant re-renders. |
| 5 | The search input filters the grid by substring match against the bookmark title or tag name. | **PASS** | `useBookmarkFilter.ts` lines 34–36 match `bookmark.title.toLowerCase().includes(query)` OR `bookmark.tags.some((tag) => tag.toLowerCase().includes(query))`. |
| 6 | Active filters are visually highlighted, and a single "Clear all" action resets them. | **PASS** | Selected tags receive distinct indigo styling in both `FilterBar` (lines 110–112) and `BookmarkCard` (lines 99–101). The "Clear all" button (lines 81–93 in `FilterBar`) and the empty-state "Clear all filters" button (lines 91–97 in `App.tsx`) both invoke `clearFilters()`, resetting tags and search query. |
| 7 | The demo loads and runs without any backend, API, or database dependencies. | **PASS** | `npm run build` succeeds with only static assets. No `fetch` or XHR calls exist in the source. Favicon images load via external `<img>` requests (not API calls) and degrade to a data-URI SVG fallback when offline. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 6/10 | 6/10 | **YES** |
| Functionality | 7/10 | 7/10 | **YES** |
| Visual Design | 6/10 | 5/10 | **YES** |
| Code Quality | 6/10 | 5/10 | **YES** |

## Bugs Found (new)

1. **Direct DOM mutation in favicon error handler.**  
   **File:** `project/src/components/BookmarkCard.tsx` (line 67)  
   **Expected:** React state or a declarative controlled pattern should drive the fallback image source.  
   **Actual:** `(e.currentTarget as HTMLImageElement).src = "data:image/svg+xml;..."` directly mutates the DOM element, bypassing React's virtual DOM reconciliation.  
   **Root Cause:** Convenience-driven imperative DOM manipulation instead of using a local `useState` for `src` and `onError`.

2. **Dead/unused asset files from template.**  
   **Files:** `project/src/assets/hero.png`, `project/src/assets/react.svg`, `project/src/assets/vite.svg`  
   **Expected:** All files in `src/` should be imported and utilized.  
   **Actual:** None of these three assets are referenced by any component or CSS module.  
   **Root Cause:** Vite template artifacts that were never cleaned up after project scaffolding.

3. **Potential horizontal overflow on very narrow mobile viewports (< 352 px).**  
   **File:** `project/src/App.tsx` (line 100)  
   **Expected:** The grid should never cause horizontal overflow on mobile.  
   **Actual:** `grid-cols-[repeat(auto-fill,minmax(320px,1fr))]` inside a container with 16 px side padding (`px-4`) creates a 320 px minimum track in a 288 px wide container when the viewport is 320 px, forcing a ~32 px horizontal overflow.  
   **Root Cause:** The `auto-fill` grid lost the explicit `grid-cols-1` safeguard for ultra-small screens that the previous breakpoint-based grid provided.

## Overall Verdict: **PASS**

All five Round 1 bugs are resolved, the production build passes, and all seven acceptance criteria are satisfied.

## Feedback for Generator

1. **Refactor the favicon fallback to use React state.** In `BookmarkCard.tsx`, replace the imperative `(e.currentTarget as HTMLImageElement).src` assignment with a local `useState` that swaps the image URL on error.
2. **Clean up unused assets.** Delete `project/src/assets/hero.png`, `react.svg`, and `vite.svg` (or move them to a public folder if they are needed later).
3. **Guard against sub-352 px overflow.** Consider adding a small-screen safeguard such as `grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(320px,1fr))]` or `minmax(min(320px, 100%), 1fr)` so the grid never exceeds the viewport width on very small devices.
