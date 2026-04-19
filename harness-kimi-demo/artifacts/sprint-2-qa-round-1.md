# Sprint 2 QA Report — Round 1

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log
- `browser_navigate http://localhost:5173` (clear localStorage) → unauthenticated redirect verified → criterion #6
- `browser_navigate http://localhost:5173` (with valid token) → main app loads, fetches live data → criterion #3
- `browser_click Sign up` + `browser_fill_form {email, password}` + `browser_click Sign up` → new user created, redirected to `/` → criterion #5
- `browser_click Add bookmark` + `browser_fill_form {url, title, summary, tags}` + `browser_click Add bookmark` → bookmark created → criterion #1, #3
- `browser_click Edit` + `browser_fill_form {title}` + `browser_click Save changes` → bookmark updated → criterion #1, #3
- `browser_click Delete` + `browser_handle_dialog accept` → bookmark deleted → criterion #1, #3
- `browser_click demo tag` → filter active, results update → criterion #3, regression
- `browser_click design tag` (with github already active) → 4/6 results shown (OR logic) → criterion #3, regression
- `browser_type "EDITED"` in search box → results filtered by title → criterion #3, regression
- `browser_navigate http://localhost:5173/collections` (after clearing localStorage) → redirected to `/login` → criterion #6
- `browser_evaluate fetch` for `/api/auth/login` with bad creds → 401 + `{detail: "Invalid credentials"}` → criterion #5
- `browser_evaluate fetch` for `/api/auth/refresh` with valid token → 200 + new tokens → criterion #7
- `browser_evaluate fetch` for `/api/auth/logout` + revoked refresh → 401 `{detail: "Token has been revoked"}` → criterion #5, #7
- `browser_evaluate fetch` for `/api/tags` → 200 + array of `{id, name}` → criterion #2
- `browser_evaluate fetch` for `/api/bookmarks?tag=github&tag=design` → 4 bookmarks (OR backend filter) → criterion #1
- `browser_evaluate fetch` for `/api/bookmarks?page=1&limit=2` → 2 bookmarks (pagination) → criterion #1
- `browser_evaluate fetch` for `/api/bookmarks?search=GitHub` → 2 bookmarks (search) → criterion #1
- `browser_evaluate fetch` for unauthenticated `/api/bookmarks` → 403 (missing bearer) → criterion #4, #6
- Screenshots saved to `artifacts/screenshots/sprint-2-*.png`

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | **Bookmark CRUD API** — All endpoints return correct status codes and JSON payloads. | **PASS** | Network tab: GET 200, POST 201, PATCH 200, DELETE 204. Response bodies contain all required fields. |
| 2 | **Tags API** — `GET /api/tags` returns authenticated user's tags as JSON array. | **PASS** | `browser_evaluate` returned `[{id, name}, …]` sorted alphabetically. Status 200. |
| 3 | **Frontend Live Data** — Grid, filters, search, add/edit/delete use live API calls preserving Sprint 1 UX. | **PASS** | Every UI mutation triggered a network request to `/api/bookmarks` or `/api/tags`; UI updated correctly. Screenshots: `sprint-2-after-add-bookmark.png`, `sprint-2-after-edit-bookmark.png`. |
| 4 | **Consistent JSON Schema** — Successful responses contain `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. Errors use `{ "detail": "..." }`. | **PASS** | Inspected POST/PATCH/GET response bodies—all fields present. FastAPI returns `{detail}` envelope for 401/403/404/409/422. |
| 5 | **JWT Login & Signup** — Register returns 201 + tokens; login returns 200 + tokens; logout invalidates refresh token. | **PASS** | Register: 201 + tokens. Login: 200 + tokens. Invalid creds: 401. Logout: 200. Revoked refresh: 401. |
| 6 | **Protected Routes** — Unauthenticated access to `/` or `/collections` redirects to `/login`. | **PASS** | After `localStorage.clear()`, navigating to `/` and `/collections` both redirected to `/login`. Screenshot: `sprint-2-login-redirect.png`. |
| 7 | **Token Refresh** — `/api/auth/refresh` exchanges valid refresh token for new access token; frontend handles expiry. | **PASS** | Manual test: refresh endpoint returned 200 + new tokens. Revoked token returned 401. Frontend `apiFetch` has automatic 401 → refresh → retry logic. |
| 8 | **Normalized Database Schema** — Separate `users`, `bookmarks`, `tags`, `bookmark_tags` tables with FKs; no redundant tag arrays. | **PASS** | `sqlite3 .schema` confirmed separate tables with `FOREIGN KEY` constraints. Tags linked via `bookmark_tags` join table only. |
| 9 | **Reproducible Migrations** — `alembic upgrade head` on fresh SQLite creates all tables; migration files committed. | **PASS** | Ran on `test_fresh.db`: all 10 tables created successfully. Three migration files present in `alembic/versions/`. |
| 10 | **Backup/Restore Documentation** — `project/docs/BACKUP_RESTORE.md` exists with actionable instructions. | **PASS** | File exists with timestamped backup/restore commands and safety notes. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 8/10 | 6/10 | ✅ |
| Functionality | 7/10 | 7/10 | ✅ |
| Visual Design | 6/10 | 5/10 | ✅ |
| Code Quality | 6/10 | 5/10 | ✅ |

## Regression Check (prior sprints)

| Sprint | Flow Tested | Result | Evidence |
|--------|-------------|--------|----------|
| Sprint 1 | Responsive grid of bookmark cards renders correctly. | **PASS** | Screenshot `sprint-2-regression-grid.png` shows 3-column responsive grid. |
| Sprint 1 | Each card displays title, hostname, favicon placeholder, tag chips. | **PASS** | Cards show all elements; favicon fallback SVG renders when external service fails. |
| Sprint 1 | Clickable tag chips with OR-logic multi-tag filtering. | **PASS** | Selecting `github` then `design` shows 4/6 results (OR logic). Screenshot: `sprint-2-or-tag-filter.png`. |
| Sprint 1 | Search by title/tag substring. | **PASS** | Typing "EDITED" filtered to matching bookmark. Screenshot: `sprint-2-search-edited.png`. |
| Sprint 1 | Relative saved date displays correctly. | **FAIL** | **REGRESSION**: All bookmarks display "8h ago" regardless of actual creation time. Screenshot: `sprint-2-regression-grid.png`. |

## Bugs Found

1. **[REGRESSION-001]** `project/backend/app/schemas/bookmark.py` (and `project/backend/app/models/bookmark.py`)
   - **Expected:** Bookmarks created seconds ago should show relative times like "just now" or "1m ago".
   - **Actual:** Every bookmark shows "8h ago" (or similar large offset) because the API returns naive datetime strings such as `"2026-04-19T15:46:12"` without timezone info.
   - **Root cause:** FastAPI/Pydantic serializes SQLAlchemy `DateTime(timezone=True)` as a naive ISO string when SQLite stores a naive value. The frontend `getRelativeTime()` parses this with `new Date(dateString)`, treating it as local time (+08:00), creating an 8-hour shift relative to the server's UTC timestamp.
   - **Evidence:** `sprint-2-regression-grid.png` shows all 6 cards displaying "8h ago" despite being created during the test session.
   - **Fix direction:** Ensure the backend emits timezone-aware ISO-8601 strings (append `Z` or include offset), or configure SQLAlchemy/SQLite to store and return UTC-aware datetimes.

2. **[BUG-002]** `project/src/pages/SettingsPage.tsx`
   - **Expected:** Consistent navigation across all authenticated pages (header should include logout).
   - **Actual:** The Settings page header lacks a **Log out** button, while the main Library page (`App.tsx`) includes one.
   - **Root cause:** `SettingsPage` defines its own header component that only contains "Library" and "Collections" links.
   - **Evidence:** Snapshot of `/settings` shows header with `link "Library"`, `link "Collections"`, but no logout button.

## Overall Verdict: **FAIL**

**Reason:** [REGRESSION-001] breaks a Sprint 1 acceptance criterion ("Each card displays … the relative saved date"). A previously-working feature now produces incorrect output for all users due to a backend-to-frontend datetime serialization mismatch. Per the QA rules, any regression from prior sprints forces an overall **FAIL**.

## Feedback for Generator

1. **Fix the datetime regression immediately.** In `project/backend/app/schemas/bookmark.py`, ensure `createdAt` and `updatedAt` are serialized as timezone-aware ISO strings (e.g., by appending `Z` or configuring Pydantic to use UTC). Alternatively, update `project/src/components/BookmarkCard.tsx` `getRelativeTime()` to treat naive strings as UTC before computing the delta.
2. **Add logout to Settings header.** In `project/src/pages/SettingsPage.tsx`, import `useAuth` and add the logout button to the header to match `App.tsx`.
3. **Type safety nit:** `project/src/api/client.ts` `updateBookmark` accepts `BookmarkCreate` (requiring `url` and `title`) but the backend supports partial updates. Change the signature to accept a partial payload type.
4. **Optional but recommended:** Add an `aria-label` to the bookmark card favicon `<img>` for better accessibility, and consider handling the Google favicon timeout more gracefully (it already has `onError`, which is good).
