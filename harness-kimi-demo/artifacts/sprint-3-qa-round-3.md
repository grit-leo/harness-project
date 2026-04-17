# Sprint 3 QA Report — Round 3

## Round 2 Bug Status

| Bug | Description | Fixed? | Evidence |
|-----|-------------|--------|----------|
| BUG-001 | Cache key in `ai_service.py` hashed URL string instead of fetched page content. | **YES** | `project/backend/app/services/ai_service.py:104` now calls `_content_hash(raw_html)`. Backend test `test_ai_cache_prevents_duplicate_llm_call` asserts cache is keyed by `ai_service._content_hash(_mock_httpx_get().text)`. |
| BUG-002 | Collections page header lacked an "Add bookmark" CTA. | **YES** | `project/src/pages/CollectionsPage.tsx:151-156` now renders an "Add bookmark" button in the header. Screenshot: `artifacts/screenshots/sprint-3-r3-collections-page.png`. |
| BUG-003 | Live OpenAI API calls return HTTP 429 `insufficient_quota`. | **NO** | Environment limitation. `OPENAI_API_KEY` is set but quota is exceeded. All live AI enrichment calls return empty tags/summary. Not a code bug, but blocks end-to-end validation of criteria #1 and #5. |

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log

| Action | Criterion Verified |
|--------|-------------------|
| `browser_navigate http://localhost:5173` → redirected to `/login` | General reachability |
| Registered new user `qa_round3_2026@example.com` / `password123` | Auth infrastructure |
| `browser_navigate http://localhost:5173/` (with token injected via `browser_evaluate`) | General app access |
| `browser_snapshot` + screenshot `sprint-3-r3-main-with-bookmarks.png` | #7 (summary on cards) |
| `browser_click Edit` on "AI Research Paper" → snapshot `sprint-3-r3-edit-modal.png` | #3 (suggested tags UI), #7 (summary in modal) |
| Accepted `machine-learning`, rejected `nlp`, edited `neural-networks` → `deep-learning` → save → screenshot `sprint-3-r3-after-save-tags.png` | #3 (accept/reject/edit), #4 (persistence) |
| `browser_click Collections` → screenshots of default collections | #8 (default collections) |
| `browser_click New collection` → fill rule-builder (Domain=github.com AND Tag=ai) → save → screenshot `sprint-3-r3-new-collection.png` | #9 (custom collections) |
| `browser_click Add bookmark` from Collections → create `https://github.com/new-ai-project` with tag `ai` → screenshot `sprint-3-r3-collection-auto-update.png` | #10 (auto-update) |
| `browser_evaluate fetch(...)` to `/api/bookmarks/{id}/suggested-tags`, `/api/collections`, `/api/collections/{id}/bookmarks` | #2, #8 (API verification) |
| `browser_navigate http://localhost:8000/docs` → screenshots `sprint-3-r3-swagger-docs*.png` | API documentation verification |

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | When a new bookmark URL is submitted, the backend fetches page content and sends sanitized text to an LLM API. | **PASS** | `bookmarks.py` triggers `background_tasks.add_task(ai_service.enrich_bookmark, ...)`. Backend test `test_summary_generated_and_persisted` mocks `httpx.get` and `_call_llm`, verifying the enrichment path executes. **Live validation blocked by OpenAI 429 quota (BUG-003).** |
| 2 | The LLM returns 3–7 relevant tags for a bookmark, exposed via `GET /api/bookmarks/{id}/suggested-tags`. | **PASS** | Endpoint exists and returns `{"suggested_tags": [...]}`. Swagger docs show the route. Backend test `test_suggested_tags_endpoint` passes. UI displays 3 suggested tags in edit modal. Screenshot: `sprint-3-r3-edit-modal.png`. |
| 3 | The frontend displays AI-suggested tags as chips in the create/edit bookmark modal, allowing the user to accept, reject, or edit each tag before saving. | **PASS with bug** | Modal shows "AI Suggested Tags" section with chips and `+` / `×` buttons. Verified: accepted "machine-learning" (added to Tags), rejected "nlp" (removed), edited "neural-networks" → "deep-learning". **Bug:** clicking `+` while a tag is in inline-edit mode fails because the input `onBlur` fires first and prevents the button `onClick`. Screenshot: `sprint-3-r3-edit-modal.png`. |
| 4 | User actions on suggested tags (accept/reject/edit) are persisted to the database and affect the bookmark's final tag list. | **PASS** | After save, the "AI Research Paper" card shows tags `research`, `machine-learning`, `ai`, `deep-learning`. Rejected "nlp" is absent. API call to `POST /api/bookmarks/{id}/apply-tags` returned 200. Screenshot: `sprint-3-r3-after-save-tags.png`. |
| 5 | The backend generates a 1–2 sentence summary for text-heavy bookmarks via an LLM and stores it on the `Bookmark` record. | **PASS** | `ai_service.enrich_bookmark` writes `bookmark.summary = result["summary"]`. Backend test `test_summary_generated_and_persisted` mocks the LLM and asserts the exact summary is persisted. **Live validation blocked by OpenAI 429 quota (BUG-003).** |
| 6 | LLM-generated tags and summaries are cached in SQLite (keyed by URL content hash) so that re-submitting the same URL does not trigger a new LLM call within 7 days. | **PASS** | `_content_hash(raw_html)` is used at `ai_service.py:104`. The `ai_cache` table stores `content_hash`, `tags`, `summary`, and `created_at`. Backend test `test_ai_cache_prevents_duplicate_llm_call` validates that duplicate calls with identical content hit the cache and the LLM mock is invoked only once. |
| 7 | The frontend displays the bookmark summary on each card (truncated if necessary) and in full inside the bookmark detail drawer/modal. | **PASS** | Cards render `line-clamp-2` summary text beneath the title. Edit modal shows the full summary in the Summary textarea. Screenshots: `sprint-3-r3-main-with-bookmarks.png`, `sprint-3-r3-edit-modal.png`. |
| 8 | The system provides at least three default smart collections ("Unread Last 7 Days", "Design Inspiration", "Recent Reads") that auto-populate based on date, domain, and tag rules. | **PASS** | `GET /api/collections` returned 4 collections including 3 defaults. "Unread Last 7 Days" shows 2 bookmarks, "Recent Reads" shows 1 bookmark, "Design Inspiration" shows 0 (no matching tags in test data). Each has a "Default" badge in the UI. Screenshots: `sprint-3-r3-collections-page.png`, `sprint-3-r3-collection-recent-reads.png`. |
| 9 | Users can create custom collections via a rule-builder UI with AND/OR filters on tags, domain, and relative date (e.g., "last N days"). | **PASS** | Created "AI GitHub" collection with AND rules `domain = github.com` + `tag = ai`. Collection appears in the sidebar, correctly returns 2 matching bookmarks. Screenshot: `sprint-3-r3-new-collection.png`. |
| 10 | Smart collections update automatically when bookmarks are added, edited, or deleted without requiring a manual page refresh. | **PASS** | After adding "New AI Project" (github.com + ai tag) from the Collections page, the "AI GitHub" collection automatically refreshed to show 2 bookmarks. The Collections page polls every 5 seconds and also refreshes on modal close. Screenshot: `sprint-3-r3-collection-auto-update.png`. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 7/10 | 6/10 | **Yes** |
| Functionality | 6/10 | 7/10 | **No** |
| Visual Design | 7/10 | 5/10 | **Yes** |
| Code Quality | 5/10 | 5/10 | **Yes** |

**Rationale:** Functionality drops below threshold due to two user-facing bugs: (1) the login form succeeds but fails to redirect because auth state is not propagated to `AuthContext`, forcing users to manually refresh; and (2) accepting a suggested tag while it is being edited does not work, creating a confusing UX.

## Bugs Found

1. **[BUG-004]** `project/src/context/AuthContext.tsx:30-41` — **Login form succeeds but user remains stuck on `/login`.**
   - **Expected:** After `login()` stores the access token and `navigate("/")` runs, the user should land on the Library page.
   - **Actual:** `PublicRoute` immediately redirects back to `/login` because `AuthContext.isAuthenticated` is still `false`; `AuthProvider` only checks the token on mount and has no mechanism to update state after `login()` is called.
   - **Root cause:** `AuthContext` decouples token storage (`api/client.ts:setTokens`) from auth-state reactivity. `LoginPage` does not call a `checkAuth` or `setAuthenticated` callback after login.
   - **Evidence:** Network trace shows `POST /api/auth/login` returned 200 with valid tokens, but the page URL remained `http://localhost:5173/login` with no error message. A full page reload (which re-runs `AuthProvider` mount effect) is required for auth to be recognized.

2. **[BUG-005]** `project/src/components/BookmarkModal.tsx:160-174` / lines 184-198 — **Accepting a suggested tag while in edit mode fails silently.**
   - **Expected:** Clicking the `+` button on a suggested tag chip should add that tag to the Tags field and remove it from suggestions, even if the tag text is currently being edited.
   - **Actual:** When the inline `<input>` is focused, clicking `+` triggers the input's `onBlur` first, which sets `editingIndex(null)` and causes a re-render. The button's `onClick` does not fire, so the tag is not accepted.
   - **Root cause:** The `onBlur` on the editable input conflicts with the `onClick` on the adjacent `+` button because the DOM element is replaced during the re-render before the click event can complete.
   - **Evidence:** Screenshot sequence `sprint-3-r3-edit-modal.png` → after clicking `+` on edited "deep-learning", the tag remains in the suggested list and the Tags field is unchanged. Pressing `Enter` first (which blurs the input) allows the subsequent accept action to work.

## Overall Verdict: **FAIL**

While all 10 Sprint 3 acceptance criteria are functionally implemented and verified, the introduction of a critical login regression (BUG-004) drops the **Functionality** dimension below its 7/10 threshold. A user cannot complete a standard SPA login without manually refreshing the page. Additionally, the suggested-tag accept-during-edit bug (BUG-005) degrades the core tagging UX. Both bugs are fixable and must be resolved before the sprint can be considered shippable.

## Feedback for Generator

1. **Fix the login auth-state propagation (BUG-004):**
   - Expose a `loginSuccess` or `checkAuth` callback from `AuthContext` that `LoginPage` can call after `await login(email, password)`.
   - Alternatively, have `login()` in `api/client.ts` emit an event or accept an optional callback so the context can re-evaluate `isAuthenticated` immediately after token storage.
   - File: `project/src/context/AuthContext.tsx`, `project/src/pages/LoginPage.tsx`, `project/src/api/client.ts`.

2. **Fix suggested-tag accept during inline editing (BUG-005):**
   - Delay the `setEditingIndex(null)` call or use `onMouseDown` with `e.preventDefault()` on the `+` button to prevent the input's `onBlur` from stealing the click event.
   - File: `project/src/components/BookmarkModal.tsx`.

3. **Consider adding a dev-mode AI fallback:**
   - Since OpenAI quota is exhausted in this environment, a `MOCK_AI=true` path (already partially present in `ai_service.py`) would allow full E2E validation of enrichment flows without real API calls.
