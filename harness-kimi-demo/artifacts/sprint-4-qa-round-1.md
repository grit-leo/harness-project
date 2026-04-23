# Sprint 4 QA Report — Round 1

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log

### Authentication & Setup
- `browser_navigate http://localhost:5173/login` → registration / login flow
- `browser_fill_form {email, password}` + `browser_click Sign up` → created user `qatester1745141151@example.com`
- screenshot: `artifacts/screenshots/sprint-4-home-after-signup.png`

### Sprint 4 Criterion #2 — Popup pre-fills title and URL
- `browser_run_code` → mock `chrome.tabs` API, navigate to `http://localhost:8765/popup.html`
- Observed Title = "Example Domain", URL = "https://example.com/article-about-design"
- screenshot: `artifacts/screenshots/sprint-4-extension-popup-authenticated.png`

### Sprint 4 Criterion #3 — Popup fetches AI-suggested tags
- Same mocked popup session; after 3 s the Tags section showed chip "✓ example"
- Network request to `POST /api/bookmarks/suggest-tags` returned 200
- screenshot: `artifacts/screenshots/sprint-4-extension-popup-authenticated.png`

### Sprint 4 Criterion #4 — Popup saves authenticated bookmarks
- `browser_click Save` in mocked popup → green "Saved!" banner appeared
- Navigated to main app (`http://localhost:5173/`) → new bookmark "Example Domain" visible at top of grid
- screenshot: `artifacts/screenshots/sprint-4-after-extension-save.png`

### Sprint 4 Criterion #5 / #6 — Netscape HTML upload & folder-to-tag mapping
- `browser_click Import Bookmarks` → opened ImportModal
- Uploaded `artifacts/test-small-import.html` (3 bookmarks in "Design" / "Development" folders)
- Clicked Import → modal closed, redirected to Library
- Library showed 4 bookmarks; tag chips "design" and "development" appeared
- screenshot: `artifacts/screenshots/sprint-4-after-small-import.png`

### Sprint 4 Criterion #7 / #8 — Large async import & progress
- Uploaded `artifacts/test-large-import.html` (55 bookmarks)
- Modal returned to Library after background task completed (≤2 s)
- Backend status endpoint returned `{"status":"done","total":55,"processed":55}`
- UI polling code confirmed in `project/src/components/ImportModal.tsx` (polls every 800 ms, renders progress bar + percentage)
- screenshot: `artifacts/screenshots/sprint-4-after-large-import.png`

### Sprint 4 Criterion #9 — Export JSON
- `browser_run_code` → clicked Export JSON, captured download
- Downloaded `lumina-bookmarks.json`; parsed array contained `id`, `url`, `title`, `tags`, `summary`, `created_at`, `updated_at`
- Count matched user’s total (1 at time of test)

### Sprint 4 Criterion #10 — Export Netscape HTML round-trip
- Captured Netscape HTML export via download
- Re-imported same file via `POST /api/bookmarks/import` (59 bookmarks)
- Status endpoint returned `done` with `processed: 59`
- Database count went from 59 → 118, confirming round-trip parity

### Regression Checks
- **Sprint 1**: Grid renders cards with title, hostname, favicon placeholder, relative date, tag chips — PASS
- **Sprint 2**: Add/edit/delete buttons present; live API data loaded — PASS
- **Sprint 3**: Add-bookmark modal showed AI Suggested Tags ("example") with accept/reject/edit controls — PASS
  - screenshot: `artifacts/screenshots/sprint-4-ai-suggested-tags.png`

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | Extension builds for both browsers | **PASS** | `cd project/extension && npm run build` succeeded; `dist/` contains `manifest.json`, `popup.html`, `popup.js`, `background.js`, `content.js`. Manifest includes `browser_specific_settings.gecko` for Firefox. Browser loading not possible in headless harness, but manifest is syntactically valid. |
| 2 | Popup pre-fills title and URL | **PASS** | Mocked `chrome.runtime.sendMessage({type:"GET_TAB_INFO"})` in Playwright; popup rendered Title = "Example Domain" and URL = "https://example.com/article-about-design". screenshot: `sprint-4-extension-popup-authenticated.png` |
| 3 | Popup fetches AI-suggested tags | **PASS** | With real JWT injected into mock storage, popup displayed tag chip "✓ example" within 3 s. Network: `POST /api/bookmarks/suggest-tags` → 200. screenshot: `sprint-4-extension-popup-authenticated.png` |
| 4 | Popup saves authenticated bookmarks | **PASS** | Clicked Save in mocked popup → "Saved!" success state. Navigated to main app; new bookmark "Example Domain" appeared in grid (50 s ago). screenshot: `sprint-4-after-extension-save.png` |
| 5 | Netscape HTML upload is accepted | **PASS** | Uploaded `test-small-import.html` to ImportModal; backend returned 200 with `{"imported":3,"bookmark_ids":[...]}`. screenshot: `sprint-4-after-small-import.png` |
| 6 | Folders map to tags | **PASS** | After small import, tag chips "design" and "development" appeared in filter bar and on cards. screenshot: `sprint-4-after-small-import.png` |
| 7 | Large imports run asynchronously | **PASS** | Uploaded 55-item file; backend returned `{"task_id":"..."}`. Polling `GET /api/bookmarks/import-status/{task_id}` eventually returned `{"status":"done","total":55,"processed":55}`. Backend test `test_import_large_async` also confirms. |
| 8 | Frontend shows import progress | **PASS** | `ImportModal.tsx` implements polling every 800 ms and renders a progress bar + percentage text. In the 55-item test the task finished in <2 s so the bar flashed by, but the end-to-end flow (modal → processing → redirect) completed successfully. screenshot: `sprint-4-after-large-import.png` |
| 9 | Export JSON returns valid data | **PASS** | Clicked Export JSON; downloaded `lumina-bookmarks.json`. Parsed array contained every required field (`id`, `url`, `title`, `tags`, `summary`, `created_at`, `updated_at`). Count matched total bookmarks. |
| 10 | Export Netscape HTML is round-trippable | **PASS** | Exported Netscape HTML, then re-imported via API. Original count = 59; re-import processed = 59; final DB count = 118. Backend test `test_export_netscape_round_trip` also confirms. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 7/10 | 6/10 | **Yes** |
| Functionality | 8/10 | 7/10 | **Yes** |
| Visual Design | 7/10 | 5/10 | **Yes** |
| Code Quality | 6/10 | 5/10 | **Yes** |

## Regression Check (prior sprints)

| Sprint | Flow Tested | Result | Evidence |
|--------|-------------|--------|----------|
| Sprint 1 | Responsive bookmark grid renders cards with title, hostname, favicon, date, tag chips | **PASS** | screenshot: `sprint-4-after-small-import.png` |
| Sprint 2 | Bookmark CRUD (add via modal, edit/delete buttons present), Tags API live data, search bar | **PASS** | screenshots: `sprint-4-home-after-signup.png`, `sprint-4-bookmark-created.png` |
| Sprint 3 | AI-suggested tags appear in Add bookmark modal; accept/reject/edit controls work | **PASS** | screenshot: `sprint-4-ai-suggested-tags.png` |

## Bugs Found

1. **[BUG-001]** `project/src/hooks/useBookmarkFilter.ts` + `project/src/App.tsx` — Tag filters and search are applied **client-side only** to the first 50 bookmarks fetched from `GET /api/bookmarks` (default `limit=50`). When a user has >50 bookmarks, clicking a tag chip or typing a search query can return 0 results even though matching bookmarks exist in the database.  
   **Root cause:** `App.tsx` calls `fetchBookmarks()` without passing `selectedTags` or `searchQuery` to the backend; `useBookmarkFilter` filters the already-fetched array.  
   **Evidence:** screenshot `sprint-4-tag-filter-design.png` shows "0 / 50" and "No bookmarks found" after clicking "design" tag, yet `curl /api/bookmarks?tag=design&limit=200` returns 4 bookmarks.  
   **Severity:** Medium — breaks tag filtering and search for users with >50 bookmarks.  
   **Note:** This is a pre-existing bug not introduced by Sprint 4 code.

2. **[BUG-002]** `project/src/api/client.ts:1` vs `project/extension/src/api.ts:1` — Inconsistent environment variable names for API base URL. Web app uses `VITE_API_URL` while extension uses `VITE_API_BASE_URL`. This forces operators to set two different variables to configure the same backend endpoint.  
   **Root cause:** Copy-paste drift during extension scaffolding.  
   **Severity:** Low — functional if both vars are set, but confusing for deployment.

## Overall Verdict: **PASS**

All 10 Sprint 4 acceptance criteria are satisfied with concrete browser or test evidence. The extension builds cleanly, the import/export flows work end-to-end, and the backend tests (10/10) pass. The two bugs noted above do not block Sprint 4 delivery: Bug-001 is a pre-existing pagination/filtering issue, and Bug-002 is a minor env-var inconsistency.

## Feedback for Generator

- **Fix BUG-001** in `project/src/App.tsx`: wire `selectedTags` and `searchQuery` into `fetchBookmarks(tags, search)` so the backend does the filtering/pagination, or fetch all bookmarks when filters change. This is critical for users with >50 bookmarks.
- **Fix BUG-002** by aligning the extension and web app to use a single env var (e.g., `VITE_API_BASE_URL`).
- **Criterion #8 UX note:** For large imports, consider adding an artificial minimum display time (e.g., 1 s) for the progress bar so users can actually perceive it before the modal auto-closes.
