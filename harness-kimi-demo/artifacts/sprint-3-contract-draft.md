# Sprint 3 Contract — AI-Powered Organization

## Scope
- **Backend AI Enrichment Service** (`project/backend/app/services/ai_service.py`): Fetches raw HTML for a submitted URL, sanitizes/truncates the content, and calls an LLM API to generate tag suggestions and a short summary.
- **Auto-Tagging Backend**: Extend `POST /api/bookmarks` to trigger async AI enrichment after creation. Store suggested tags in a transient state accessible to the frontend before the user finalizes them.
- **Auto-Tagging API**: New endpoints `GET /api/bookmarks/{id}/suggested-tags` and `POST /api/bookmarks/{id}/apply-tags` to retrieve and persist user-approved tags.
- **Content Summarization Backend**: Persist a 1–2 sentence summary on the `Bookmark` model and include it in list/detail API responses.
- **LLM Response Cache**: SQLite table `ai_cache` keyed by URL content hash to store tags and summaries, preventing duplicate LLM calls for identical URLs.
- **Smart Collections Backend** (`project/backend/app/models/collection.py`, `project/backend/app/routers/collections.py`): New data model and CRUD endpoints for rule-based collections, plus a query engine that evaluates AND/OR filters on tag, domain, and date fields.
- **Smart Collections Frontend**: New page/component showing default collections and a visual rule-builder for creating custom collections.
- **Summary & Suggested Tags UI**: Update `BookmarkCard` and `BookmarkModal` to display generated summaries and suggested tag chips with accept/reject/edit actions.

## Acceptance Criteria
| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | When a new bookmark URL is submitted, the backend fetches page content and sends sanitized text to an LLM API. | Integration test or manual cURL: `POST /api/bookmarks` with a new URL; verify backend logs or a mocked HTTP client records an outbound LLM request containing page text. |
| 2 | The LLM returns 3–7 relevant tags for a bookmark, exposed via `GET /api/bookmarks/{id}/suggested-tags`. | Automated test: mock LLM response with 4 tags; assert the endpoint returns exactly 4 suggested tags. |
| 3 | The frontend displays AI-suggested tags as chips in the create/edit bookmark modal, allowing the user to accept, reject, or edit each tag before saving. | UI E2E test or manual check: open modal for a newly created bookmark; see suggested tag chips; verify clicking "Add" promotes the tag to the saved list, clicking "X" discards it, and inline editing updates the tag text. |
| 4 | User actions on suggested tags (accept/reject/edit) are persisted to the database and affect the bookmark's final tag list. | API test: call `POST /api/bookmarks/{id}/apply-tags` with a mix of accepted, edited, and rejected tags; verify `GET /api/bookmarks/{id}` returns only the accepted/edited tags in its `tags` array. |
| 5 | The backend generates a 1–2 sentence summary for text-heavy bookmarks via an LLM and stores it on the `Bookmark` record. | Automated test: mock LLM to return a fixed summary string; assert the bookmark object in the database contains that exact summary. |
| 6 | LLM-generated tags and summaries are cached in SQLite (keyed by URL content hash) so that re-submitting the same URL does not trigger a new LLM call within 7 days. | Automated test: submit an identical URL twice in succession; assert the second request reads from the `ai_cache` table and the LLM mock is invoked only once. |
| 7 | The frontend displays the bookmark summary on each card (truncated if necessary) and in full inside the bookmark detail drawer/modal. | UI manual check: load the bookmark grid; confirm each card renders summary text beneath the title; open a bookmark modal and confirm the full summary is visible. |
| 8 | The system provides at least three default smart collections ("Unread Last 7 Days", "Design Inspiration", "Recent Reads") that auto-populate based on date, domain, and tag rules. | API/UI test: `GET /api/collections` returns ≥3 default collections; `GET /api/collections/{id}/bookmarks` returns the correct filtered bookmarks for each default rule set. |
| 9 | Users can create custom collections via a rule-builder UI with AND/OR filters on tags, domain, and relative date (e.g., "last N days"). | UI manual check: navigate to the Collections page; click "New Collection"; add a rule such as "domain = github.com" AND "tag = ai"; save; confirm the new collection appears and its bookmark list reflects the rule. |
| 10 | Smart collections update automatically when bookmarks are added, edited, or deleted without requiring a manual page refresh. | UI manual check: add a bookmark that matches an existing collection rule; switch to that collection view; confirm the new bookmark appears within 5 seconds (or after the standard React Query refetch interval). |

## Out of Scope
- Real-time WebSocket push notifications for AI enrichment completion (frontend may poll or rely on standard query refetching).
- Browser extension or mobile share-sheet integration (deferred to Sprint 4).
- Import/export of bookmarks in Netscape HTML or JSON formats (deferred to Sprint 4).
- Social features, public collections, discovery feeds, or collaborative editing (deferred to Sprint 5).
- Advanced machine-learning feedback loops where user accept/reject data retrains a custom model (data is persisted this sprint but model retraining is future work).
- Automatic thumbnail/favicon extraction or storage infrastructure.
- LLM cost accounting, rate-limiting dashboards, or multi-provider fallback logic beyond basic HTTP error handling.

## Dependencies
- Sprint 1 frontend must be complete and stable: React 18 + Vite app with `BookmarkCard`, `BookmarkModal`, `FilterBar`, responsive grid, and routing.
- Sprint 2 backend infrastructure must be operational: FastAPI application with SQLite database, Alembic migrations, JWT authentication (`/api/auth/login`, `/api/auth/register`), and full CRUD endpoints for bookmarks and tags (`/api/bookmarks`, `/api/tags`).
- Existing data models (`User`, `Bookmark`, `Tag`, `BookmarkTag`) must be in place and migrated.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLite
- **AI Provider:** OpenAI GPT-4o-mini or equivalent compatible API via `httpx`
- **Caching:** SQLite table (`ai_cache`) — no Redis required
- **Testing:** `pytest` for backend unit/integration tests; Playwright or manual QA for frontend validation
