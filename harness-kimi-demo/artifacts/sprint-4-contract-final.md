# Sprint 4 Contract — Capture Ecosystem

## Scope

### 4.1 Browser Extension (Manifest V3)
A one-click browser extension that lets users save the current page without leaving their workflow.

**Components / Files:**
- `project/extension/manifest.json` — Manifest V3 configuration for Chrome and Firefox.
- `project/extension/src/popup.tsx` — React popup UI for the save dialog.
- `project/extension/src/background.ts` — Service worker for API communication and tab inspection.
- `project/extension/src/api.ts` — Shared client that calls the Lumina backend using the user’s JWT.
- `project/extension/vite.config.ts` & `project/extension/tsconfig.json` — Build toolchain aligned with the main frontend.
- `project/extension/dist/` — Packaged extension output (`.zip` for Chrome, `.xpi` artifacts for Firefox).

**Behavior:**
- Clicking the extension icon opens a 380×520 px popup.
- The popup reads the active tab’s `title` and `url` via the `chrome.tabs` API and pre-fills them.
- On open, the popup sends `{url, title}` to `POST /api/bookmarks/suggest-tags` and displays 3–7 AI-suggested tags within 3 seconds.
- The user can accept/reject/edit tags and click **Save**, which POSTs to `/api/bookmarks` with the JWT `Authorization` header.
- The popup shows success/error states and closes automatically on success.

### 4.2 Import & Export
Backend and frontend support for migrating bookmarks in and out of Lumina.

**Backend APIs (FastAPI):**
- `POST /api/bookmarks/import` — Accepts a Netscape HTML bookmark file (`multipart/form-data`).
  - Parses `<DT><A>` links and `<H3>` folders.
  - Maps each folder name to a tag (created if it does not exist).
  - Returns a `task_id` for files with >50 bookmarks; triggers an asynchronous background import.
  - For small files (≤50 bookmarks), imports synchronously and returns the created bookmark IDs.
- `GET /api/bookmarks/import-status/{task_id}` — Returns progress (`pending`, `in_progress`, `done`, `failed`) and counts (`total`, `processed`, `errors`).
- `GET /api/bookmarks/export?format=json` — Streams all user bookmarks as a JSON array (`application/json`).
- `GET /api/bookmarks/export?format=netscape` — Streams all user bookmarks as a Netscape HTML file (`text/html`).

**Frontend Pages / Components:**
- `project/src/pages/Settings.tsx` (new) — Houses Import and Export controls.
- `project/src/components/ImportModal.tsx` (new) — File drop-zone, upload button, and live progress bar that polls `import-status`.
- `project/src/components/ExportButtons.tsx` (new) — Two buttons: **Export JSON** and **Export Netscape HTML**.

**Parser / Serializer Modules:**
- `project/backend/app/services/netscape_parser.py` — HTML → bookmark/tag list.
- `project/backend/app/services/netscape_exporter.py` — Bookmark list → Netscape HTML.
- `project/backend/app/services/import_task.py` — Background worker for large imports.

---

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | **Extension builds for both browsers** | Running `npm run build` inside `project/extension/` produces a valid `dist/` folder. Loading `dist/` as an unpacked extension in Chrome `chrome://extensions` and Firefox `about:debugging` shows zero manifest errors. |
| 2 | **Popup pre-fills title and URL** | With the extension installed, open any web page, click the Lumina icon, and observe that the popup’s Title and URL fields exactly match the active tab. |
| 3 | **Popup fetches AI-suggested tags** | Opening the popup on a news article or blog post displays 3–7 tag chips within 3 seconds, fetched from `POST /api/bookmarks/suggest-tags`. |
| 4 | **Popup saves authenticated bookmarks** | Clicking **Save** in the popup creates a new bookmark visible in the main React app (`GET /api/bookmarks`) under the logged-in user. A 401 response is returned if the JWT is missing or expired. |
| 5 | **Netscape HTML upload is accepted** | A Netscape HTML file exported from Chrome/Firefox uploads successfully to `POST /api/bookmarks/import` and returns HTTP 200 (small file) or a `task_id` (large file). |
| 6 | **Folders map to tags or collections** | After importing a Netscape file containing a folder named "Design", at least one imported bookmark carries the tag "Design" or belongs to a collection named "Design". |
| 7 | **Large imports run asynchronously** | Uploading a file with >50 bookmarks returns a `task_id`. Calling `GET /api/bookmarks/import-status/{task_id}` eventually returns `done` and the final bookmark count matches the file. |
| 8 | **Frontend shows import progress** | The Import modal displays a progress bar (or percentage text) that updates from 0 % to 100 % while polling the status endpoint for large imports. |
| 9 | **Export JSON returns valid data** | Clicking **Export JSON** downloads a `.json` file. Parsing it yields an array where every element contains `id`, `url`, `title`, `tags`, `summary`, `created_at`, and `updated_at`. The count equals the user’s total bookmark count. |
| 10 | **Export Netscape HTML is round-trippable** | Clicking **Export Netscape HTML** downloads a `.html` file. Re-importing that same file (without deletions) produces the same number of bookmarks as the original export. |

---

## Out of Scope

- Publishing the extension to the Chrome Web Store or Firefox Add-ons (packaging only).
- Safari extension or mobile share sheet (iOS / Android).
- Import from non-Netscape formats (e.g., CSV, Pinboard JSON, Pocket HTML).
- Duplicate detection / merge logic during import (bookmarks are created as-is).
- Real-time collaborative import (single-user imports only).
- Thumbnail generation for imported bookmarks.

---

## Dependencies

- **Sprint 2 backend** — FastAPI server with JWT authentication (`/api/auth/login`, `/api/auth/register`) and protected routes.
- **Sprint 3 backend** — SQLite database schema including `Bookmark`, `Tag`, `BookmarkTag`, and `Collection` tables. AI tagging service (`ai_service.py`) must be callable from the extension popup via a dedicated suggest-tags endpoint or the existing create endpoint.
- **Sprint 3 frontend** — React 18 application with existing bookmark list, tag chips, and routing so that newly created bookmarks and imported tags are immediately visible.
- **Environment** — Backend URL must be configurable (e.g., `VITE_API_BASE_URL`) for both the web app and the extension.

---

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLite (Alembic migrations)
- **Extension:** Manifest V3, built with Vite + React + TypeScript, sharing Tailwind config and color tokens with the main app
- **All previous sprint code is located in:** `project/`
