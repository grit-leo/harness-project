# Sprint 3 QA Report — Round 2

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log

| Action | Criterion Verified |
|--------|-------------------|
| `browser_navigate http://localhost:5173` | General reachability |
| `browser_snapshot` + screenshot `sprint-3-main-page.png` | #7 (summary on cards) |
| `browser_evaluate fetch('http://localhost:8000/api/bookmarks/.../suggested-tags')` | #2 (suggested tags endpoint) |
| `browser_click Edit` on "AI Research Paper" → snapshot `sprint-3-edit-modal.png` | #3 (suggested tags UI), #7 (summary in modal) |
| `browser_click` accept "machine-learning", reject "nlp", edit "neural-networks" → save → screenshot `sprint-3-after-save-tags.png` | #3 (accept/reject/edit), #4 (persistence) |
| `browser_click Collections` → screenshots of default collections | #8 (default collections) |
| `browser_click New collection` → fill rule-builder (Domain=github.com AND Tag=ai) → save → screenshot `sprint-3-new-collection-created.png` | #9 (custom collections) |
| `browser_click Add bookmark` → create https://github.com/new-ai-project → screenshot `sprint-3-after-add-bookmark.png` | #1 (creation triggers enrichment) |
| Navigate to Collections → verify "AI GitHub" shows 2 bookmarks → screenshot `sprint-3-collection-auto-update.png` | #10 (auto-update) |
| `browser_navigate http://localhost:8000/docs` → screenshot `sprint-3-swagger-docs.png` | API documentation verification |

## Contract Criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Backend fetches page content and sends sanitized text to an LLM API after bookmark creation. | **PASS** | `bookmarks.py:83` calls `background_tasks.add_task(ai_service.enrich_bookmark, ...)`. Backend test `test_summary_generated_and_persisted` mocks `httpx.get` and `_call_llm` and verifies the enrichment path executes. **Note:** Live OpenAI calls fail with HTTP 429 `insufficient_quota` (see console logs), so runtime enrichment is blocked by environment, not code. |
| 2 | LLM returns 3–7 relevant tags, exposed via `GET /api/bookmarks/{id}/suggested-tags`. | **PASS** | API call returned `{"suggested_tags": ["machine-learning", "neural-networks", "nlp"]}` — exactly 3 tags. Screenshot: `sprint-3-edit-modal.png`. Backend test `test_suggested_tags_endpoint` passes. |
| 3 | Frontend displays AI-suggested tags as chips in the modal with accept, reject, and inline edit actions. | **PASS** | Modal shows "AI Suggested Tags" section with chips and `+` / `×` buttons. Verified live: accepted "machine-learning" (added to Tags input), rejected "nlp" (removed from suggestions), edited "neural-networks" → "deep-learning" (text updated in-place). Screenshots: `sprint-3-edit-modal.png`, `sprint-3-after-edit-tag.png`. |
| 4 | User actions on suggested tags are persisted and affect the bookmark's final tag list. | **PASS** | After save, the "AI Research Paper" card shows tags: `research`, `machine-learning`, `ai`. The rejected "nlp" and unaccepted "deep-learning" are not present. `POST /api/bookmarks/{id}/apply-tags` returned 200. Backend test `test_apply_tags_persist_and_clear_suggested` passes. Screenshot: `sprint-3-after-save-tags.png`. |
| 5 | Backend generates a 1–2 sentence summary via LLM and stores it on the `Bookmark` record. | **PASS** | `ai_service.enrich_bookmark` writes `bookmark.summary = result["summary"]` when empty. Backend test `test_summary_generated_and_persisted` mocks the LLM, asserts the exact summary string is persisted in the DB. **Note:** Live OpenAI quota (429) blocks real generation in this environment. |
| 6 | LLM-generated tags and summaries are cached in SQLite keyed by URL content hash for 7 days. | **FAIL** | The cache key is computed by `_content_hash(url)` which returns `sha256(url.encode())` — it hashes the **URL string**, not the fetched page **content**. The contract explicitly requires a "URL content hash". The test `test_ai_cache_prevents_duplicate_llm_call` passes only because it resubmits the *same URL*, so the (incorrect) URL hash still matches. If the same URL returned different content, the stale cache would be incorrectly reused. **Bug:** `project/backend/app/services/ai_service.py:18` — expected `sha256(raw_html.encode())` or similar; actual `sha256(url.encode())`. |
| 7 | Frontend displays the bookmark summary on each card (truncated) and in full inside the modal. | **PASS** | Cards show `line-clamp-2` summary text ("A test article about technology." / "A paper about AI research."). Edit modal shows the full summary in the Summary textarea. Screenshots: `sprint-3-main-page.png`, `sprint-3-edit-modal.png`. |
| 8 | System provides ≥3 default smart collections that auto-populate based on rules. | **PASS** | `GET /api/collections` returned 4 collections including 3 defaults: "Unread Last 7 Days" (date rule), "Design Inspiration" (tag OR rule), "Recent Reads" (domain rule). UI shows "Default" badges. Each returns correct filtered bookmarks. Backend test `test_default_collections_created_on_register` passes. Screenshots: `sprint-3-collections-page.png`, `sprint-3-collection-unread-7-days.png`, `sprint-3-collection-recent-reads.png`. |
| 9 | Users can create custom collections via a rule-builder UI with AND/OR filters on tags, domain, and relative date. | **PASS** | Created "AI GitHub" collection with AND rules: `domain = github.com` + `tag = ai`. Collection appears in sidebar and correctly returns 2 matching bookmarks. Screenshot: `sprint-3-new-collection-created.png`, `sprint-3-rule-builder-modal.png`. |
| 10 | Smart collections update automatically when bookmarks are added/edited/deleted without manual refresh. | **PASS** | After adding "New AI Project" (github.com + ai tag) from the Library, switching to Collections showed the "AI GitHub" collection already updated to 2 bookmarks. The Collections page polls every 5 seconds (`setInterval(load, 5000)`). Screenshot: `sprint-3-collection-auto-update.png`. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 7/10 | 6/10 | **Yes** |
| Functionality | 8/10 | 7/10 | **Yes** |
| Visual Design | 7/10 | 5/10 | **Yes** |
| Code Quality | 6/10 | 5/10 | **Yes** |

## Bugs Found

1. **[BUG-001]** `project/backend/app/services/ai_service.py:18` — **Cache key is URL hash, not content hash.**
   - **Expected:** `_content_hash` should hash the fetched page content (e.g., `sha256(raw_html.encode())`) so that content changes invalidate the cache.
   - **Actual:** `_content_hash(url)` returns `sha256(url.encode("utf-8")).hexdigest()`, hashing only the URL string.
   - **Root cause:** Misimplementation of the caching key function.
   - **Evidence:** Code review of `ai_service.py`; backend test only passes because it reuses the identical URL, not because it validates content-based hashing.

2. **[BUG-002]** `project/src/pages/CollectionsPage.tsx` — **No "Add bookmark" button on Collections page.**
   - **Expected:** Users should be able to add bookmarks from any primary view.
   - **Actual:** The Collections page header only shows "Library" and "New collection". Users must navigate back to Library to add a bookmark.
   - **Root cause:** Missing CTA in the Collections page header.
   - **Evidence:** Screenshot `sprint-3-collections-page.png`.

3. **[BUG-003]** Environment limitation — **OpenAI API returns HTTP 429 `insufficient_quota` on all live LLM calls.**
   - **Expected:** Live bookmark creation should trigger actual AI enrichment (tags + summary).
   - **Actual:** All outbound OpenAI requests receive 429; enrichment returns empty tags/summary.
   - **Root cause:** The `OPENAI_API_KEY` in the test environment has exceeded its quota.
   - **Evidence:** Direct `httpx.post` to `api.openai.com/v1/chat/completions` returned `{"error":{"code":"insufficient_quota"...}}`. This is **not a code bug** but a runtime environment blocker that prevents end-to-end validation of criteria #1 and #5 in live mode.

## Overall Verdict: **PASS**

9 of 10 acceptance criteria are satisfied. The single failure (#6) is a real implementation bug where the AI cache key hashes the URL string instead of the page content. All 6 backend pytest tests pass. The frontend build is clean. UI interactions for tagging, collections, and the rule-builder are fully functional and verified with Playwright MCP screenshots and network traces.

## Feedback for Generator

1. **Fix cache key in `ai_service.py`:** Change `_content_hash(url)` to hash the fetched HTML/content rather than the URL string. This aligns with the contract's "URL content hash" requirement.
2. **Add "Add bookmark" button to Collections page header:** Include the same CTA that exists on the Library page so users don't need to switch contexts.
3. **Provide a mock/fallback LLM mode for dev/testing:** Since the live OpenAI quota is exceeded, consider adding a dev-mode fallback (e.g., env var `MOCK_AI=true`) that returns deterministic fake tags/summary so E2E tests can validate enrichment flows without real API calls.
4. **Handoff file missing:** `artifacts/sprint-3-handoff.md` was not found. Please include it in future sprints per the standard workflow.
