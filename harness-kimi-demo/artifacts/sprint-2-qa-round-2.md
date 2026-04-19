# Sprint 2 QA Report — Round 2

## Round 1 Bug Status

| Bug | Description | Fixed? | Evidence |
|-----|-------------|--------|----------|
| [REGRESSION-001] | Relative time displayed "8h ago" for all bookmarks due to naive datetime serialization | **YES** | Screenshot `sprint-2-after-add-bookmark.png` shows "just now"; `sprint-2-after-edit-bookmark.png` shows "32s ago"; `sprint-2-regression-grid.png` shows "6m ago". Backend now emits `Z`-suffixed UTC strings (e.g., `"2026-04-19T16:02:18Z"`). |
| [BUG-002] | Settings page header lacked a Log out button | **YES** | Screenshot `sprint-2-settings-page.png` shows logout icon button in header. `SettingsPage.tsx` now imports `useAuth` and renders logout. |
| Type-safety nit | `updateBookmark` accepted `BookmarkCreate` instead of partial payload | **YES** | `project/src/api/client.ts` now defines `BookmarkUpdate` with all optional fields (`url?: string`, `title?: string`, etc.). |

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log
- `browser_navigate http://localhost:5173` + `localStorage.clear()` → redirected to `/login` → criterion #6
- `browser_click Sign up` + `browser_fill_form {email, password}` + `browser_click Sign up` → created user, redirected to `/` → criterion #5
- `browser_click Add bookmark` + `browser_fill_form {url, title, summary, tags}` + `browser_click Add bookmark` → bookmark created with correct relative time → criterion #1, #3
- `browser_click Edit` + `browser_type title` + `browser_click Save changes` → title updated to "Test Repository EDITED" → criterion #1, #3
- `browser_type "EDITED"` in search box → 1 result → criterion #3, regression
- `browser_click qa tag` → filter active, 1 result → criterion #3, regression
- Added second bookmark "Design Article" with tags `design, inspiration`
- `browser_click design tag` (with qa already active) → 2/2 results shown (OR logic) → criterion #3, regression
- `browser_evaluate` click Delete button + `browser_handle_dialog accept` → bookmark deleted → criterion #1, #3
- `browser_click Settings` → Settings page loads with logout button → criterion #6, BUG-002 fix
- `browser_click Log out` on Settings page → redirected to `/login` → criterion #5, #6
- `browser_fill_form {email, password}` + `browser_click Sign in` → logged back in → criterion #5
- `browser_evaluate fetch` for `/api/tags` → 200 + array of `{id, name}` → criterion #2
- `browser_evaluate fetch` for `/api/bookmarks` → 200 + correct schema with `Z` timestamps → criterion #1, #4
- `browser_evaluate fetch` for `/api/bookmarks?search=EDITED` → 1 result → criterion #1
- `browser_evaluate fetch` for `/api/bookmarks?page=1&limit=1` → 1 result (pagination) → criterion #1
- `browser_evaluate fetch` for `/api/bookmarks?tag=qa&tag=design` → 1 result (OR filter) → criterion #1
- `browser_evaluate fetch` unauthenticated `/api/bookmarks` → 403 `{detail: "Not authenticated"}` → criterion #4, #6
- `browser_evaluate fetch` `/api/auth/refresh` → 200 + new tokens → criterion #7
- `browser_evaluate fetch` `/api/auth/login` with bad creds → 401 `{detail: "Invalid credentials"}` → criterion #5
- `browser_evaluate fetch` `/api/auth/logout` + revoked refresh → 401 `{detail: "Token has been revoked"}` → criterion #5, #7
- Screenshots saved to `artifacts/screenshots/sprint-2-*.png`

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | **Bookmark CRUD API** — All endpoints return correct status codes and JSON payloads. | **PASS** | `browser_evaluate`: GET 200, POST 201 (verified via UI add), PATCH 200 (verified via UI edit), DELETE 204 (verified via UI delete). Pagination, search, and tag filters all return 200. |
| 2 | **Tags API** — `GET /api/tags` returns authenticated user's tags as JSON array. | **PASS** | `browser_evaluate` returned `[{id, name}, …]` sorted alphabetically. Status 200. |
| 3 | **Frontend Live Data** — Grid, filters, search, add/edit/delete use live API calls preserving Sprint 1 UX. | **PASS** | Every UI mutation triggered API calls and UI updated correctly. OR tag logic, search, and clear-all work identically to Sprint 1. Screenshots: `sprint-2-after-add-bookmark.png`, `sprint-2-after-edit-bookmark.png`, `sprint-2-or-tag-filter.png`. |
| 4 | **Consistent JSON Schema** — Successful responses contain `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. Errors use `{ "detail": "..." }`. | **PASS** | Inspected response bodies—all fields present including `createdAt`/`updatedAt` with `Z` suffix. Error envelope `{detail}` used for 401, 403, 404, 422. |
| 5 | **JWT Login & Signup** — Register returns 201 + tokens; login returns 200 + tokens; logout invalidates refresh token. | **PASS** | Register: 201 + tokens (via UI). Login: 200 + tokens. Invalid creds: 401. Logout: 200. Revoked refresh: 401. |
| 6 | **Protected Routes** — Unauthenticated access to `/` or `/collections` redirects to `/login`. | **PASS** | After `localStorage.clear()`, navigating to `/` and `/collections` both redirected to `/login`. Screenshot: `sprint-2-login-redirect.png`. |
| 7 | **Token Refresh** — `/api/auth/refresh` exchanges valid refresh token for new access token; frontend handles expiry. | **PASS** | Refresh endpoint returned 200 + new tokens. Revoked token returned 401. Frontend `apiFetch` has automatic 401 → refresh → retry logic. |
| 8 | **Normalized Database Schema** — Separate `users`, `bookmarks`, `tags`, `bookmark_tags` tables with FKs; no redundant tag arrays. | **PASS** | `sqlite3 .schema` confirmed separate tables with `FOREIGN KEY` constraints. Tags linked via `bookmark_tags` join table only. No tag array on `bookmarks` table. |
| 9 | **Reproducible Migrations** — `alembic upgrade head` on fresh SQLite creates all tables; migration files committed. | **PASS** | Ran on `test_fresh.db`: all 10 tables created successfully. Three migration files present in `alembic/versions/`. |
| 10 | **Backup/Restore Documentation** — `project/docs/BACKUP_RESTORE.md` exists with actionable instructions. | **PASS** | File exists with timestamped backup/restore commands and safety notes. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 8/10 | 6/10 | ✅ |
| Functionality | 8/10 | 7/10 | ✅ |
| Visual Design | 6/10 | 5/10 | ✅ |
| Code Quality | 6/10 | 5/10 | ✅ |

## Regression Check (prior sprints)

| Sprint | Flow Tested | Result | Evidence |
|--------|-------------|--------|----------|
| Sprint 1 | Responsive grid of bookmark cards renders correctly. | **PASS** | Screenshot `sprint-2-regression-grid-wide.png` shows proper card sizing at 1280px. |
| Sprint 1 | Each card displays title, hostname, favicon placeholder, tag chips, relative date. | **PASS** | Cards show all elements; favicon renders via Google service with SVG fallback on error. Relative time now correct. |
| Sprint 1 | Clickable tag chips with OR-logic multi-tag filtering. | **PASS** | Selecting `qa` then `design` shows 2/2 results (OR logic). Screenshot: `sprint-2-or-tag-filter.png`. |
| Sprint 1 | Search by title/tag substring. | **PASS** | Typing "EDITED" filtered to matching bookmark. Screenshot: `sprint-2-search-edited.png`. |
| Sprint 1 | Relative saved date displays correctly. | **PASS** | New bookmark shows "just now", then "16s ago", "32s ago", "6m ago" as time passes. Screenshot: `sprint-2-after-add-bookmark.png`. |

## Bugs Found

No new bugs found in Round 2. All Round 1 bugs have been fixed.

## Overall Verdict: **PASS**

All Sprint 2 acceptance criteria pass with live browser and API evidence. All Round 1 bugs are resolved:
- Datetime serialization now uses UTC with `Z` suffix, fixing relative times.
- Settings page now includes a logout button.
- `BookmarkUpdate` type is correctly partial.

No regressions from Sprint 1 were detected.

## Feedback for Generator

1. **Great job fixing the datetime regression.** The `UtcDatetime` custom serializer in `project/backend/app/schemas/common.py` correctly appends `Z` to naive SQLite datetimes, and the frontend relative-time display is now accurate.
2. **Settings page logout is now consistent** with the main app header.
3. **Optional:** Consider adding `aria-label="Log out"` to the Settings page logout button (it currently only has `title="Log out"`), for better screen-reader accessibility.
