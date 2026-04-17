# Sprint 2 QA Report — Round 1

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log
- `browser_navigate http://localhost:5173` → criterion #3, #6
- `browser_snapshot` → observed mock bookmark grid, no auth prompts, no login UI
- `browser_take_screenshot` → `artifacts/screenshots/sprint-2-homepage.png`
- `browser_navigate http://localhost:5173/login` → criterion #6
- `browser_take_screenshot` → `artifacts/screenshots/sprint-2-login-route.png` (shows homepage, not login page)
- `browser_evaluate fetch('http://localhost:8000/health')` → backend reachable
- `browser_evaluate POST /api/auth/register` from frontend origin → 500/CORS error
- `browser_evaluate POST /api/auth/login` → 200 + tokens (criterion #5)
- `browser_evaluate GET /api/bookmarks` with Bearer token → 200 + list with `suggestedTags` extra field (criterion #1, #4)
- `browser_evaluate GET /api/tags` with Bearer token → 200 + tag array (criterion #2)
- `browser_evaluate POST /api/auth/refresh` with valid refresh token → 200 + new tokens (criterion #7)
- `browser_evaluate POST /api/bookmarks` → 500 (criterion #1)
- `browser_network_requests` on frontend homepage load → **zero API calls** (criterion #3)
- `browser_console_messages` → no uncaught JS errors on initial load; CORS/500 errors appear only on manual fetch tests
- curl `PATCH /api/bookmarks/{id}` → empty body / 500 (criterion #1)
- curl `DELETE /api/bookmarks/{id}` → 500 `Internal Server Error` (criterion #1)
- `cd project && npm run build` → succeeds without errors
- `cd project/backend && alembic upgrade head` on fresh SQLite → creates all tables correctly
- `git ls-files backend/alembic/versions/` → **empty** (criterion #9)
- `ls project/docs/BACKUP_RESTORE.md` → **No such file** (criterion #10)
- `browser_close` → completed

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | **Bookmark CRUD API** — All bookmark CRUD endpoints return correct status codes and JSON payloads. | **FAIL** | GET returns 200 with array, but POST /api/bookmarks returns 500, PATCH returns 500 (empty body), DELETE returns 500 `Internal Server Error`. Tested via curl and Playwright `browser_evaluate`. |
| 2 | **Tags API** — `GET /api/tags` returns the authenticated user's tags as a JSON array. | **PASS** | Playwright `browser_evaluate` returned 200 with `[{"id":"...","name":"demo"}, {"id":"...","name":"test"}]`. |
| 3 | **Frontend Live Data** — The bookmark grid operates using live API calls instead of mock data. | **FAIL** | `project/src/App.tsx:3` imports `mockBookmarks` and `allTags` from `./data/mockBookmarks`. `browser_network_requests` on homepage load shows **zero** API calls. Screenshot: `artifacts/screenshots/sprint-2-homepage.png`. |
| 4 | **Consistent JSON Schema** — Every successful bookmark response contains required fields; error responses use consistent envelope. | **FAIL** | GET bookmark responses include unauthorized field `suggestedTags: []` (not in contract). 500 errors return empty body or generic HTML, not `{ "detail": "..." }`. Code review: `BookmarkOut` schema (`project/backend/app/schemas/bookmark.py:20-27`) cannot map SQLAlchemy `created_at`/`updated_at` to `createdAt`/`updatedAt` and cannot serialize `List[Tag]` ORM objects to `List[str]`. |
| 5 | **JWT Login & Signup** — Auth endpoints work correctly with proper status codes and tokens. | **FAIL** | `/api/auth/login` returns 200 + tokens ✅. `/api/auth/register` returns **500** on live server (tested via curl and Playwright). `/api/auth/logout` returns 200 ✅. Register failure blocks this criterion. |
| 6 | **Protected Routes** — Accessing `/` without a valid token redirects to `/login`. | **FAIL** | No login page exists. `browser_navigate` to `/login` renders the same homepage (screenshot: `artifacts/screenshots/sprint-2-login-route.png`). `project/src/main.tsx` has **no router** (`react-router` not used). App loads mock data without any auth check. |
| 7 | **Token Refresh** — Refresh endpoint works and frontend silently refreshes without forcing re-login. | **FAIL** | `/api/auth/refresh` endpoint returns 200 + new tokens when tested manually ✅. However, the **frontend has no auth flow at all** — no login page, no token storage usage in App.tsx, no silent refresh integration. Criterion requires frontend behavior. |
| 8 | **Normalized Database Schema** — SQLite contains separate tables with FK relationships and a join table. | **PASS** | `sqlite3 .schema` and `alembic upgrade head` both confirm `users`, `bookmarks`, `tags`, `bookmark_tags` tables with proper `FOREIGN KEY` constraints. No redundant tag arrays on `bookmarks`. |
| 9 | **Reproducible Migrations** — `alembic upgrade head` creates tables and migration files are committed to git. | **FAIL** | `alembic upgrade head` works on fresh DB ✅. However, `git ls-files backend/alembic/versions/` returns **empty** and `git status` shows `?? backend/` — migrations are **untracked/uncommitted**. Contract explicitly requires committed migration scripts. |
| 10 | **Backup/Restore Documentation** — `project/docs/BACKUP_RESTORE.md` exists with actionable instructions. | **FAIL** | File does not exist. `ls project/docs/BACKUP_RESTORE.md` → `No such file or directory`. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 3/10 | 6/10 | **NO** |
| Functionality | 3/10 | 7/10 | **NO** |
| Visual Design | 5/10 | 5/10 | **YES** |
| Code Quality | 2/10 | 5/10 | **NO** |

## Bugs Found

1. **[BUG-001]** `project/src/App.tsx:3` — Frontend still uses `mockBookmarks` and `allTags` from `./data/mockBookmarks.ts` instead of calling live APIs. **Expected:** App fetches bookmarks/tags from backend on mount. **Actual:** Static mock data is rendered; network tab shows zero API calls. **Root cause:** API client functions were written in `project/src/api/client.ts` but never integrated into `App.tsx`. **Evidence:** screenshot `artifacts/screenshots/sprint-2-homepage.png`, `browser_network_requests` empty.

2. **[BUG-002]** `project/src/main.tsx` — No React Router, no `/login` or `/signup` pages, no route protection. **Expected:** Unauthenticated users redirected to `/login`; authenticated users can access the app. **Actual:** `/login` renders the homepage unchanged; no auth UI exists anywhere in `src/`. **Root cause:** Routing and auth pages were never implemented. **Evidence:** screenshot `artifacts/screenshots/sprint-2-login-route.png`, grep for `react-router` returned no matches.

3. **[BUG-003]** `project/backend/app/schemas/bookmark.py:20-27` — `BookmarkOut` cannot serialize bookmark responses. **Expected:** Pydantic schema accepts `List[str]` for `tags` and maps `created_at`/`updated_at` to `createdAt`/`updatedAt`. **Actual:** `ResponseValidationError` because SQLAlchemy returns `List[Tag]` objects and snake_case attributes don't auto-map to camelCase field names without aliases. **Root cause:** Missing `Field(alias=...)` or a `@computed_field`/`@field_validator` to convert Tag objects to strings. **Evidence:** `TestClient` traceback shows `string_type` error on `tags.0` and `missing` errors on `createdAt`/`updatedAt`.

4. **[BUG-004]** `project/backend/app/models/__init__.py` — Empty `__init__.py` causes SQLAlchemy mapper failures depending on import order. **Expected:** `from app.models.bookmark import Bookmark` works reliably in any context. **Actual:** `InvalidRequestError: expression 'bookmark_tags' failed to locate a name` when `bookmark_tag.py` is not imported before `Bookmark` is queried. **Root cause:** `Bookmark.tags` relationship uses `secondary="bookmark_tags"` string reference, but the `bookmark_tags` table class (`BookmarkTag`) is not guaranteed to be loaded. **Evidence:** Direct Python script failed until `from app.models.bookmark_tag import BookmarkTag` was added before other imports.

5. **[BUG-005]** `project/backend/main.py:6` — `Base.metadata.create_all(bind=engine)` runs at import time. **Expected:** Schema creation is handled exclusively by Alembic migrations. **Actual:** Tables are auto-created on every import, masking migration issues and making it impossible to verify that migrations alone are sufficient. **Root cause:** `create_all` should not be called in production/qa startup; Alembic should own schema management.

6. **[BUG-006]** Live server `/api/auth/register` and mutating bookmark endpoints (POST, PATCH, DELETE) return HTTP 500. **Expected:** 201 on register, 201 on POST, 200 on PATCH, 204 on DELETE. **Actual:** 500 with empty body or generic `Internal Server Error`. **Root cause:** Unknown server state — likely stale running process vs. newer on-disk code, combined with BUG-003 and BUG-004. **Evidence:** curl and Playwright both return 500; server logs inaccessible without restart.

7. **[BUG-007]** `project/backend/alembic/versions/` — Migration files exist on disk but are **not committed to git**. **Expected:** `git ls-files backend/alembic/versions/` lists migration scripts. **Actual:** Returns empty; `git status` shows `?? backend/`. **Root cause:** Backend directory was never added/committed to git.

8. **[BUG-008]** `project/docs/BACKUP_RESTORE.md` — Missing documentation file. **Expected:** Step-by-step backup/restore instructions for SQLite. **Actual:** File does not exist. **Root cause:** Documentation was never written.

## Overall Verdict: **FAIL**

## Feedback for Generator

The Sprint 2 implementation is **incomplete and broken** in several critical areas:

1. **Frontend API Integration (`project/src/App.tsx`)** — Replace the `mockBookmarks` import with live API calls using the already-written `fetchBookmarks()` and `fetchTags()` from `project/src/api/client.ts`. Add loading and error states.

2. **Auth UI & Routing (`project/src/main.tsx`, new files)** — Install `react-router-dom`, wrap the app in a router, and create `/login` and `/signup` pages. Use `AuthContext` (already written) to guard routes and redirect unauthenticated users.

3. **Fix Pydantic Schema (`project/backend/app/schemas/bookmark.py`)** — 
   - Add alias mapping for datetime fields: `createdAt: datetime = Field(alias="created_at")` (and set `model_config = ConfigDict(populate_by_name=True)`).
   - Add a validator to convert `List[Tag]` ORM objects to `List[str]` for the `tags` field, or use a computed field.

4. **Fix SQLAlchemy Import Order (`project/backend/app/models/__init__.py`)** — Import `BookmarkTag` inside `__init__.py` (or ensure all models are imported in dependency order) so `secondary="bookmark_tags"` resolves correctly.

5. **Remove Auto-Create on Import (`project/backend/main.py`)** — Delete `Base.metadata.create_all(bind=engine)` from `main.py`. Schema creation should be driven solely by `alembic upgrade head`.

6. **Commit Backend to Git** — Run `git add backend/` and `git add docs/` (once docs are written) and commit.

7. **Write Missing Docs** — Create `project/docs/BACKUP_RESTORE.md` with concrete SQLite backup/restore commands (e.g., `cp lumina.db lumina.db.backup` and restore instructions).

8. **Restart Server After Fixes** — The currently running backend server appears to be using stale/cached state; restart it after applying the above fixes and re-test every CRUD endpoint with curl or TestClient.
