# Sprint 2 Contract — Core Backend & Sync

## Scope
1. **FastAPI Backend Service**  
   - Initialize a Python FastAPI project inside `project/backend/` with Uvicorn as the ASGI server.
   - Configure CORS to allow requests from the Vite dev server and production build.

2. **Relational Database & ORM**  
   - Define SQLAlchemy models for `User`, `Bookmark`, `Tag`, and a `BookmarkTag` join table (normalized schema).
   - Use SQLite as the database engine for this sprint.

3. **Version-Controlled Migrations**  
   - Set up Alembic in `project/backend/alembic/` with migration scripts committed to git.
   - Ensure `alembic upgrade head` creates all required tables reproducibly on a fresh environment.

4. **RESTful CRUD API**  
   - Implement endpoints:
     - `GET /api/bookmarks` — list user bookmarks with pagination, search, and tag filters.
     - `POST /api/bookmarks` — create a bookmark.
     - `PATCH /api/bookmarks/{id}` — update a bookmark.
     - `DELETE /api/bookmarks/{id}` — delete a bookmark.
     - `GET /api/tags` — list all tags for the authenticated user.
   - Enforce consistent JSON response schemas and proper HTTP status codes (200, 201, 204, 400, 401, 404).

5. **JWT Authentication**  
   - Implement `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/refresh`.
   - Issue short-lived access tokens and longer-lived refresh tokens.
   - Hash passwords with bcrypt.

6. **Frontend Integration & Auth UI**  
   - Replace mock data in the React frontend with live API calls (fetch or existing HTTP client).
   - Add `/login` and `/signup` pages matching the Sprint 1 design language.
   - Protect the main bookmark routes: unauthenticated users are redirected to `/login`.
   - Implement silent token refresh or automatic expiry handling so users stay logged in across sessions.

7. **Documentation**  
   - Write `project/docs/BACKUP_RESTORE.md` describing how to back up and restore the SQLite database file.

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | **Bookmark CRUD API** — All bookmark CRUD endpoints (`GET`, `POST`, `PATCH`, `DELETE`) return correct status codes and JSON payloads. | Run automated or manual tests against each endpoint; verify `GET` returns a list, `POST` returns 201 + created object, `PATCH` returns 200 + updated object, `DELETE` returns 204. |
| 2 | **Tags API** — `GET /api/tags` returns the authenticated user's tags as a JSON array. | Send an authenticated request and assert 200 status with an array of tag objects (`id`, `name`). |
| 3 | **Frontend Live Data** — The bookmark grid, tag filters, search bar, add/edit/delete flows operate using live API calls instead of mock data while preserving all Sprint 1 UX behaviors. | Load the app, perform add/edit/delete/search/filter actions manually or via E2E test; confirm network tab shows API calls and UI updates match Sprint 1 behavior. |
| 4 | **Consistent JSON Schema** — Every successful bookmark response contains `id`, `title`, `url`, `tags[]`, `summary`, `createdAt`, `updatedAt`. Error responses use a consistent envelope (e.g., `{ "detail": "..." }`) with proper HTTP status codes. | Inspect response bodies for all bookmark endpoints; assert field presence and consistent error shapes. |
| 5 | **JWT Login & Signup** — `/api/auth/register` creates a user and returns tokens; `/api/auth/login` returns tokens for valid credentials; `/api/auth/logout` invalidates the session or refresh token. | Submit valid and invalid payloads to each auth endpoint; assert correct status codes (200/201 for success, 401 for invalid credentials) and token presence on success. |
| 6 | **Protected Routes** — Accessing the main app (`/`) or bookmark pages without a valid access token redirects the browser to `/login`. | Open the app in an incognito window; assert immediate redirect to `/login`. Supply a valid token and assert access is granted. |
| 7 | **Token Refresh** — A refresh endpoint (`/api/auth/refresh`) exchanges a valid refresh token for a new access token, and the frontend silently refreshes or handles expiry without forcing manual re-login during a normal session. | Allow access token to expire (or mock expiry); confirm frontend calls refresh and continues operating, or confirm refresh endpoint returns a new access token when tested manually. |
| 8 | **Normalized Database Schema** — The SQLite database contains separate `users`, `bookmarks`, `tags`, and `bookmark_tags` tables with foreign-key relationships; no redundant tag arrays are stored on the `bookmarks` table. | Inspect schema with `.schema` or an ORM inspector; verify join table exists and foreign keys are defined. |
| 9 | **Reproducible Migrations** — Running `alembic upgrade head` on a fresh SQLite file creates all tables successfully, and all migration files are present in `project/backend/alembic/versions/`. | Delete/recreate the SQLite file, run `alembic upgrade head`, and verify all expected tables exist. Check git for committed migration scripts. |
| 10 | **Backup/Restore Documentation** — `project/docs/BACKUP_RESTORE.md` exists and provides step-by-step instructions for copying and restoring the SQLite database file. | Open the file and confirm it contains actionable backup and restore commands. |

## Out of Scope
- AI-powered auto-tagging, summarization, or smart collections (planned for Sprint 3).
- Browser extension or mobile capture (planned for Sprint 4).
- Import/export of bookmarks (planned for Sprint 4).
- Public/shared collections, social feeds, or collaboration features (planned for Sprint 5).
- Redis caching, PostgreSQL, or cloud infrastructure migrations.
- Automatic thumbnail/favicon fetching or remote asset storage.
- Real-time updates via WebSockets.
- OAuth providers, multi-factor authentication, or advanced role-based access control.

## Dependencies
- Sprint 1 frontend codebase exists in `project/` (React 18 + Vite + TypeScript + Tailwind CSS).
- Sprint 1 UX behaviors are functional: responsive bookmark card grid, tag filtering (OR logic), search by title/tag, and visual highlight/clear of active filters.
- Mock data schema from Sprint 1 aligned with the planned API resource shape.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLite
- **ORM & Migrations:** SQLAlchemy + Alembic
- **Authentication:** JWT (via `python-jose` or PyJWT) with bcrypt password hashing
- **HTTP Client:** Native `fetch` or existing frontend HTTP library
