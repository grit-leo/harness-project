# Sprint 7 Contract — AI Tag Suggestions in Add Modal

## Scope

**Frontend**
- Refactor `project/src/components/BookmarkModal.tsx`:
  - Replace the automatic 800-ms tag suggestion trigger with an explicit **"Suggest tags with AI"** button placed next to the tag input.
  - Display AI-suggested tags as clickable chips using a **distinct visual style** (e.g., emerald accent border / dashed outline) so they are clearly differentiated from user-added tags.
  - Add a **"Apply all suggested tags"** one-click action.
  - Support **individual dismissal** (×) and individual acceptance (+) of each suggested chip.
  - Show a **subtle loading spinner** while suggestions are being fetched.
  - Allow **re-triggering** the suggestion request when the user edits the title after suggestions have already appeared.
  - Ensure the suggestion flow works when URL metadata fetch fails (fallback to title-only suggestion via the backend).
- Update `project/src/api/client.ts`:
  - Extend `fetchSuggestedTagsForUrl` to accept an optional `summary` parameter and pass it to the backend.

**Backend**
- Update `project/backend/app/routers/bookmarks.py`:
  - Evolve the existing `POST /api/bookmarks/suggest-tags` endpoint so it accepts `{ title, url?, summary? }`. `title` is required; `url` and `summary` are optional.
  - When `url` is provided, reuse the existing `ai_service.fetch_and_enrich` path (with HTML fetch + content-hash cache).
  - When `url` is missing or HTML fetch fails, fall back to a **title-only LLM suggestion** using `summary` as extra context.
  - Enforce that the endpoint returns **3–5 concise tags**.
  - Apply **tag normalization** before returning (lowercase; alphanumeric characters and hyphens only; strip everything else).
- Update `project/backend/app/services/ai_service.py`:
  - Add a `suggest_tags_from_text(title: str, summary: str | None = None) -> list[str]` helper that calls the LLM with a lightweight prompt.
  - Add **URL-keyed caching** (e.g., hash the URL string and store/lookup in `AICache` or a compatible lightweight cache) so repeated calls for the same URL return instantly without redundant LLM calls.
- Update `project/backend/app/schemas/bookmark.py`:
  - Introduce a `SuggestTagsPayload` Pydantic schema (`title: str`, `url: str | None = None`, `summary: str | None = None`).

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | **Explicit trigger button** — In `AddBookmarkModal`, a "Suggest tags with AI" button is visible next to the tag input after the user has entered a title (and optionally a URL). | Manual UI test: open modal, type a title → button appears. |
| 2 | **No auto-trigger** — Tags are no longer suggested automatically on an 800-ms debounce; suggestions only fire when the user clicks the trigger button. | Manual UI test: type URL + title → wait 2s → verify no network request to `suggest-tags` until button is clicked. |
| 3 | **Distinct chip styling** — AI-suggested tag chips use a visual style (e.g., emerald accent, dashed border, or distinctive background) that is visibly different from user-added tags in the same modal. | Visual inspection / screenshot diff of `BookmarkModal`. |
| 4 | **Apply all action** — Clicking "Apply all" adds every current suggested tag to the user's tag list and clears the suggestions section. | Manual UI test: click "Apply all" → all suggested tags move to the Tags input field. |
| 5 | **Individual accept & dismiss** — Each suggested chip has controls to accept (+) or dismiss (×) that tag individually. Dismissed tags are removed from suggestions; accepted tags are appended to the user's tag list. | Manual UI test: accept one tag, dismiss another → verify state. |
| 6 | **Loading spinner** — While the frontend is waiting for `POST /api/bookmarks/suggest-tags`, a subtle spinner (or animated indicator) is shown inside or adjacent to the suggestions area. | Manual UI test: throttle network to 3G, click "Suggest tags" → spinner visible. |
| 7 | **Re-trigger on title edit** — After suggestions are shown, if the user changes the title input, the "Suggest tags with AI" button becomes enabled again and can be clicked to fetch fresh suggestions. | Manual UI test: get suggestions → edit title → click button again → new request fires. |
| 8 | **Fallback without URL metadata** — If metadata fetch fails (or URL is omitted), clicking "Suggest tags with AI" still returns suggestions based on title (and optional summary). | Backend test + UI test: call `POST /api/bookmarks/suggest-tags` with `{title: "React hooks guide"}` only → receive 3–5 tags. |
| 9 | **Lightweight endpoint contract** — `POST /api/bookmarks/suggest-tags` accepts `title` (required), `url` (optional), and `summary` (optional), and returns `{"suggested_tags": [...]}`. | Backend unit test: assert HTTP 200 and schema compliance for payloads with and without `url`. |
| 10 | **Tag count enforcement** — The endpoint returns no fewer than 3 and no more than 5 tags. | Backend unit test: mock LLM responses with 1, 5, and 7 tags → verify output is clamped/normalized to 3–5. |
| 11 | **Tag normalization** — Every returned tag is lowercase and contains only alphanumeric characters and hyphens (spaces and special chars replaced/removed). | Backend unit test: input tags `["AI/ML", "React JS", "CSS3!"]` → output `["ai-ml", "react-js", "css3"]`. |
| 12 | **URL-based caching** — A second identical request (same URL + title) completes in <1s because the result is cached keyed by URL; no redundant LLM call is made. | Backend unit test: call endpoint twice with same URL → second call hits cache, `mock_llm.assert_called_once()`. |
| 13 | **End-to-end creation flow** — User can paste a URL, fetch metadata, click "Suggest tags with AI", apply suggestions, and submit the bookmark without errors. | Playwright / manual e2e test through full add-bookmark flow. |

## Out of Scope
- Refactoring the background AI enrichment that runs after bookmark creation (`ai_service.enrich_bookmark`).
- Changing the persisted-bookmark suggestion path (`GET /api/bookmarks/{id}/suggested-tags`).
- Adding new database migrations (existing `AICache` table can be reused or extended in-place for URL-keyed caching).
- Browser-extension or mobile share-sheet integration.
- Smart collections, digest, or social features.
- Thumbnail / metadata fetch improvements (Sprint 6 scope).

## Dependencies
- Sprint 1 (frontend grid, tag chips, filtering) — must be present.
- Sprint 2 (backend CRUD, auth, database) — must be present.
- Sprint 3 (AI auto-tagging infrastructure, `ai_service`, `AICache`) — must be present.
- Sprint 6 (`AddBookmarkModal` metadata fetch, `thumbnail_url`, `POST /api/bookmarks/fetch-metadata`) — must be present so the modal already has the URL + title + preview flow.

## Tech Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI (Python) + SQLite
- All previous sprint code is in `project/`
