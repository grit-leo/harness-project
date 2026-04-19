# Sprint 2 Handoff

## What Was Built

### Backend (`project/backend/`)
- **FastAPI service** (`main.py`) with CORS configured for Vite dev server and production builds.
- **SQLAlchemy ORM models** in `app/models/`:
  - `User` — id, email, password_hash, created_at
  - `Bookmark` — id, user_id, url, title, summary, created_at, updated_at
  - `Tag` — id, user_id, name, created_at
  - `BookmarkTag` — join table linking bookmarks and tags (normalized schema, no redundant tag arrays on bookmarks)
- **Alembic migrations** (`alembic/versions/`):
  - `ee6e64cc77f2_initial_migration.py`
  - `0026c005dbd6_add_ai_cache_collections_and_suggested_.py`
  - `d1873c708280_add_visibility_collaborators_follows_.py`
- **RESTful CRUD routers** (`app/routers/`):
  - `bookmarks.py` — `GET /api/bookmarks` (with search, tag filter, pagination), `POST /api/bookmarks`, `PATCH /api/bookmarks/{id}`, `DELETE /api/bookmarks/{id}`
  - `tags.py` — `GET /api/tags`
  - `auth.py` — `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/refresh`
- **JWT security** (`app/core/security.py`) with bcrypt password hashing, short-lived access tokens (15 min), and longer-lived refresh tokens (7 days). Refresh-token revocation is handled in-memory.
- **Dependency injection** (`app/core/deps.py`) using `HTTPBearer` to protect routes.
- **Pydantic schemas** (`app/schemas/`) for request/response validation with consistent JSON envelopes.
- **Backup/Restore docs** at `project/docs/BACKUP_RESTORE.md`.

### Frontend (`project/src/`)
- **API client** (`api/client.ts`) — wraps all Sprint 2 endpoints with automatic token attachment, 401 handling, and silent token refresh.
- **Auth context** (`context/AuthContext.tsx`) — manages login state, checks token expiry on mount, and triggers silent refresh.
- **Protected route** (`components/ProtectedRoute.tsx`) — redirects unauthenticated users to `/login`.
- **Login & Signup pages** (`pages/LoginPage.tsx`, `pages/SignupPage.tsx`) — match Sprint 1 design language (slate-950 background, indigo-500 accents, Inter typography).
- **Live data integration** — `App.tsx` fetches bookmarks and tags from the API on load; add/edit/delete flows call the backend and refresh the list.
- **Filter hook** (`hooks/useBookmarkFilter.ts`) — preserves Sprint 1 UX: search by title/tag substring, OR-logic multi-tag filtering, clear-all action.
- **Components**:
  - `BookmarkCard.tsx` — rich card with title, hostname, favicon, relative date, tag chips, edit/delete actions
  - `FilterBar.tsx` — sticky search + tag cloud with active-highlight states
  - `BookmarkModal.tsx` — add/edit bookmark form

## How to Run

### Backend
```bash
cd project/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Frontend
```bash
cd project
npm install
npm run dev
```

The Vite dev server runs on `http://localhost:5173` and proxies API calls to `http://localhost:8000`.

### Production Build
```bash
cd project
npm run build
```

## Known Limitations
- Refresh-token revocation is stored in an in-memory `set`, so it resets on server restart. For multi-process deployments a persistent store (Redis/DB) would be needed.
- Thumbnail/favicon fetching relies on external Google favicon service; no local thumbnail generation.
- AI auto-tagging and smart collections are implemented in Sprint 3+ code that already exists but are out of scope for Sprint 2.

## Self-Evaluation Against Contract

| # | Criterion | Status |
|---|-----------|--------|
| 1 | **Bookmark CRUD API** — All bookmark CRUD endpoints (`GET`, `POST`, `PATCH`, `DELETE`) return correct status codes and JSON payloads. | ✅ PASS — Verified via automated tests and manual API calls. `POST` returns 201, `PATCH` returns 200, `DELETE` returns 204. |
| 2 | **Tags API** — `GET /api/tags` returns the authenticated user's tags as a JSON array. | ✅ PASS — Returns `[{id, name}]` sorted alphabetically. |
| 3 | **Frontend Live Data** — The bookmark grid, tag filters, search bar, add/edit/delete flows operate using live API calls instead of mock data while preserving all Sprint 1 UX behaviors. | ✅ PASS — `App.tsx` uses `fetchBookmarks`, `fetchTags`, `createBookmark`, `updateBookmark`, `deleteBookmark`. Filtering and search remain client-side for responsiveness. |
| 4 | **Consistent JSON Schema** — Every successful bookmark response contains `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. Error responses use a consistent envelope (`{ "detail": "..." }`) with proper HTTP status codes. | ✅ PASS — `BookmarkOut` schema enforces all fields. Errors return FastAPI default `{detail}` format with appropriate status codes (400, 401, 404, 409). |
| 5 | **JWT Login & Signup** — `/api/auth/register` creates a user and returns tokens; `/api/auth/login` returns tokens for valid credentials; `/api/auth/logout` invalidates the session or refresh token. | ✅ PASS — Register returns 201 + tokens. Login returns 200 + tokens. Logout revokes the refresh token. Invalid credentials return 401. |
| 6 | **Protected Routes** — Accessing the main app (`/`) or bookmark pages without a valid access token redirects the browser to `/login`. | ✅ PASS — `ProtectedRoute` checks `isAuthenticated` and renders `<Navigate to="/login" />` when missing. |
| 7 | **Token Refresh** — A refresh endpoint (`/api/auth/refresh`) exchanges a valid refresh token for a new access token, and the frontend silently refreshes or handles expiry without forcing manual re-login during a normal session. | ✅ PASS — `refreshAccessToken()` is called automatically on 401 responses in `apiFetch`. `AuthContext` also checks expiry on mount and refreshes. |
| 8 | **Normalized Database Schema** — The SQLite database contains separate `users`, `bookmarks`, `tags`, and `bookmark_tags` tables with foreign-key relationships; no redundant tag arrays are stored on the `bookmarks` table. | ✅ PASS — Schema inspection confirms separate tables with FKs. Tags are stored via `bookmark_tags` join table. |
| 9 | **Reproducible Migrations** — Running `alembic upgrade head` on a fresh SQLite file creates all required tables successfully, and all migration files are present in `project/backend/alembic/versions/`. | ✅ PASS — Verified on a fresh `test_fresh.db`. All 10 tables created. Three migration files are committed. |
| 10 | **Backup/Restore Documentation** — `project/docs/BACKUP_RESTORE.md` exists and provides step-by-step instructions for copying and restoring the SQLite database file. | ✅ PASS — File exists with commands for timestamped backups and restores. |
