# Sprint 4 Handoff

## What Was Built

### Browser Extension (Manifest V3)
- **`project/extension/popup.html`** — Entry HTML for the 380×520 px popup.
- **`project/extension/src/popup.tsx`** — React popup UI that:
  - Reads the active tab’s title and URL via `chrome.tabs` API.
  - Calls `POST /api/bookmarks/suggest-tags` to fetch 3–7 AI-suggested tags.
  - Lets users accept/reject/edit tags and save the bookmark with an authenticated JWT header.
  - Shows success/error states and auto-closes on success.
- **`project/extension/src/background.ts`** — Service worker handling `GET_TAB_INFO` messages.
- **`project/extension/src/content.ts`** — Content script that listens for `LUMINA_SET_TOKEN` / `LUMINA_CLEAR_TOKEN` postMessages from the web app and syncs the JWT to `chrome.storage.local`.
- **`project/extension/src/api.ts`** — Shared API client; `API_BASE_URL` is now configurable via `VITE_API_BASE_URL` at build time.
- **`project/extension/vite.config.ts`** — Vite build config aligned with the main frontend.
- **`project/extension/public/manifest.json`** — Manifest V3 for Chrome & Firefox (includes `browser_specific_settings` for Gecko).

### Import & Export (Backend)
- **`project/backend/app/routers/bookmarks.py`** — Already contained:
  - `POST /api/bookmarks/import` — Accepts Netscape HTML; sync import for ≤50 bookmarks, async `task_id` for larger files.
  - `GET /api/bookmarks/import-status/{task_id}` — Returns progress (`pending`, `in_progress`, `done`, `failed`).
  - `GET /api/bookmarks/export?format=json|netscape` — Streams JSON array or Netscape HTML.
- **`project/backend/app/services/netscape_parser.py`** — Parses `<DT><A>` links and `<H3>` folders into `ParsedBookmark` objects.
- **`project/backend/app/services/netscape_exporter.py`** — Serializes bookmarks back to Netscape HTML, grouping by first tag.
- **`project/backend/app/services/import_task.py`** — Background worker for large imports with in-memory task tracking.

### Import & Export (Frontend)
- **`project/src/pages/SettingsPage.tsx`** — Houses Import and Export controls.
- **`project/src/components/ImportModal.tsx`** — File drop-zone, upload button, and live progress bar that polls `import-status`.
- **`project/src/components/ExportButtons.tsx`** — Two buttons: **Export JSON** and **Export Netscape HTML**.
- **`project/src/api/client.ts`** — `importBookmarks`, `fetchImportStatus`, and `exportBookmarks` helpers.

### Tests
- **`project/backend/tests/test_sprint4.py`** — 10 new tests covering:
  - Small synchronous import
  - Folder-to-tag mapping
  - Large asynchronous import with status polling
  - JSON export schema validation
  - Netscape HTML export
  - Export → re-import round-trip
  - Suggest-tags endpoint
  - Missing JWT returns 401
  - Invalid file type rejection

## How to Run

### Start the backend
```bash
cd project/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Start the web app
```bash
cd project
npm run dev
```

### Build the extension
```bash
cd project/extension
npm run build
```
Load `project/extension/dist/` as an unpacked extension in Chrome (`chrome://extensions`) or Firefox (`about:debugging`).

### Run all tests
```bash
cd project/backend
source .venv/bin/activate
pytest tests/ -v
```

## Known Limitations
- The extension’s `host_permissions` in `manifest.json` is hardcoded to `http://localhost:8000/*`. If the backend URL is changed, the manifest must be updated to match (or the user must grant additional host permissions at runtime).
- Large import tasks are stored in-memory (`_import_tasks` dict) and will be lost on server restart. This is acceptable for the demo/harness scope.
- No duplicate detection during import; re-importing the same file creates duplicate bookmarks.
- Extension packaging to `.zip`/`.xpi` is out of scope per the contract.

## Self-Evaluation Against Contract

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Extension builds for both browsers — `npm run build` produces a valid `dist/` folder with zero manifest errors | ✅ Pass |
| 2 | Popup pre-fills title and URL — reads active tab via `chrome.tabs` API | ✅ Pass |
| 3 | Popup fetches AI-suggested tags — calls `POST /api/bookmarks/suggest-tags` and displays 3–7 chips | ✅ Pass |
| 4 | Popup saves authenticated bookmarks — JWT sent in `Authorization` header; 401 returned if missing/expired | ✅ Pass |
| 5 | Netscape HTML upload is accepted — `POST /api/bookmarks/import` handles `.html`/`.htm` files | ✅ Pass |
| 6 | Folders map to tags — `<H3>` folder names become tags on imported bookmarks | ✅ Pass |
| 7 | Large imports run asynchronously — files >50 bookmarks return `task_id`; status endpoint reaches `done` | ✅ Pass |
| 8 | Frontend shows import progress — `ImportModal` polls status and renders a progress bar | ✅ Pass |
| 9 | Export JSON returns valid data — array with `id`, `url`, `title`, `tags`, `summary`, `created_at`, `updated_at` | ✅ Pass |
| 10 | Export Netscape HTML is round-trippable — re-importing an exported file yields the same bookmark count | ✅ Pass |
