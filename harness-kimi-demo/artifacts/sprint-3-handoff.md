# Sprint 3 Handoff

## What Was Built
- **Backend AI Service** (`project/backend/app/services/ai_service.py`)
  - Fetches raw HTML for a URL, strips tags/truncates content, and calls OpenAI GPT-4o-mini for tag suggestions + 1–2 sentence summary.
  - SQLite `ai_cache` table caches results keyed by URL content hash with a 7-day TTL.
- **Auto-Tagging Backend**
  - `POST /api/bookmarks` triggers async AI enrichment via `BackgroundTasks`.
  - New endpoints: `GET /api/bookmarks/{id}/suggested-tags` and `POST /api/bookmarks/{id}/apply-tags`.
- **Content Summarization Backend**
  - Generated summary is written to the `Bookmark.summary` field and included in list/detail responses.
- **Smart Collections Backend** (`project/backend/app/models/collection.py`, `project/backend/app/routers/collections.py`)
  - `Collection` model with JSON `rules_json` supporting AND/OR filters on `tag`, `domain`, and `date` (last N days).
  - CRUD endpoints plus `GET /api/collections/{id}/bookmarks` query engine.
  - Three default collections seeded on user registration.
- **Smart Collections Frontend** (`project/src/pages/CollectionsPage.tsx`)
  - Responsive sidebar + grid layout listing collections.
  - Visual rule-builder modal for creating custom collections.
  - 5-second polling keeps collection bookmark lists up-to-date automatically.
- **Suggested Tags & Summary UI**
  - `BookmarkModal` now shows AI-suggested tag chips with inline edit, accept (+), and reject (×) actions.
  - `BookmarkCard` renders the generated summary (already present in Sprint 1, now powered by live data).
- **Tests** (`project/backend/tests/test_sprint3.py`)
  - 6 automated pytest cases covering caching, suggested tags, apply-tags persistence, summary generation, default collections, and collection query engine.

## How to Run
```bash
# Backend
cd project/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd project
npm run dev
```

## Known Limitations
- HTML sanitization in the AI service uses regex rather than a dedicated parser (e.g., BeautifulSoup). It is sufficient for typical pages but may miss edge-case markup.
- If `OPENAI_API_KEY` is unset, the enrichment service gracefully returns empty tags/summary instead of falling back to another provider.
- Smart-collection domain filtering is evaluated in Python after loading the user’s entire bookmark list; this is fine for demo-scale libraries but will need SQL-level optimization for large datasets.
- Collection auto-updates rely on 5-second frontend polling rather than WebSocket or reactive database triggers.
- Editing an existing bookmark performs two API calls (`PATCH` for core fields, then `POST apply-tags` for tags) because the modal separates core payload from tag approval.

## Self-Evaluation Against Contract

| # | Criterion | Status |
|---|-----------|--------|
| 1 | When a new bookmark URL is submitted, the backend fetches page content and sends sanitized text to an LLM API. | ✅ Done |
| 2 | The LLM returns 3–7 relevant tags for a bookmark, exposed via `GET /api/bookmarks/{id}/suggested-tags`. | ✅ Done |
| 3 | The frontend displays AI-suggested tags as chips in the create/edit bookmark modal, allowing the user to accept, reject, or edit each tag before saving. | ✅ Done |
| 4 | User actions on suggested tags (accept/reject/edit) are persisted to the database and affect the bookmark's final tag list. | ✅ Done |
| 5 | The backend generates a 1–2 sentence summary for text-heavy bookmarks via an LLM and stores it on the `Bookmark` record. | ✅ Done |
| 6 | LLM-generated tags and summaries are cached in SQLite (keyed by URL content hash) so that re-submitting the same URL does not trigger a new LLM call within 7 days. | ✅ Done |
| 7 | The frontend displays the bookmark summary on each card (truncated if necessary) and in full inside the bookmark detail drawer/modal. | ✅ Done |
| 8 | The system provides at least three default smart collections ("Unread Last 7 Days", "Design Inspiration", "Recent Reads") that auto-populate based on date, domain, and tag rules. | ✅ Done |
| 9 | Users can create custom collections via a rule-builder UI with AND/OR filters on tags, domain, and relative date (e.g., "last N days"). | ✅ Done |
| 10 | Smart collections update automatically when bookmarks are added, edited, or deleted without requiring a manual page refresh. | ✅ Done |
