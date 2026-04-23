# Sprint 7 QA Report — Round 2

> **Note:** Playwright MCP was used extensively for live browser testing but crashed during the `page.route` interception used to slow down the `suggest-tags` endpoint (identical failure mode to Round 1). All interactive UI verification was performed before the crash. Remaining backend/API criteria were verified via `curl`.

## Round 1 Bug Status

| Bug | Description | Fixed? | Evidence |
|-----|-------------|--------|----------|
| BUG-001 | `BookmarkModal.tsx:173-175` — `handleSuggestTags` silently swallows all errors | **NO** | Code inspection: catch block is still empty (`// silently fail`) at lines 167-178 of `project/src/components/BookmarkModal.tsx`. |
| BUG-002 | `ai_service.py:132` — `_url_cache` is an unbounded in-memory dictionary | **NO** | Code inspection: `_url_cache: dict[str, list[str]] = {}` remains at line 132 of `project/backend/app/services/ai_service.py` with no max-size or TTL eviction. |
| BUG-003 | Playwright MCP screenshot timeout / crash | N/A | Infrastructure issue, not application code. Reproduced in Round 2 when `browser_run_code` + `page.route` was used. |

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes** (crashed mid-session during route interception)

## Playwright Test Log

| Action | Criterion |
|--------|-----------|
| `browser_navigate http://localhost:5173` → redirected to `/signup` | Setup |
| `browser_fill_form {email: qa-sprint7-r2@example.com, password: password123}` + `browser_click Sign up` | Setup |
| `browser_click Add bookmark` → modal opens | #1, #13 |
| `browser_type Title: "React hooks guide"` → "Suggest tags with AI" button appears | #1 |
| `browser_type URL: "https://example.com/article"` → wait 2.5s | #2 |
| `browser_network_requests` (filter `/suggest-tags`) → **zero requests** before click | #2 |
| `browser_click "Suggest tags with AI"` → AI Suggested Tags section renders 3 chips | #1, #3, #5, #13 |
| Screenshot: `artifacts/screenshots/sprint-7-r2-suggestions-shown.png` | #3 (visual styling) |
| `browser_click (+) on "example"` → tag moves to Tags input; removed from suggestions | #5 |
| `browser_click (×) on "react"` → tag removed from suggestions | #5 |
| `browser_click "Apply all"` → remaining "hooks" appended to Tags input; section cleared | #4 |
| `browser_type Title: "Advanced React patterns"` → `browser_click "Suggest tags with AI"` | #7 |
| `browser_network_requests` → 2nd request body contains updated title | #7 |
| `browser_run_code` → `page.route` with 2s delay for `/suggest-tags` | #6 (interrupted) |
| `browser_click "Suggest tags with AI"` → **Playwright MCP crashed** | #6 (incomplete) |

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | **Explicit trigger button** visible after title entered | **PASS** | DOM snapshot shows button "Suggest tags with AI" appears only after title input is non-empty. Ref `e123` visible in snapshot `page-2026-04-22T10-22-03-269Z.yml`. |
| 2 | **No auto-trigger** on 800-ms debounce | **PASS** | Network log: zero `POST /api/bookmarks/suggest-tags` requests recorded during 2.5-second wait after typing URL+title. Request only appeared after explicit button click. |
| 3 | **Distinct chip styling** for AI-suggested tags | **PASS** | Screenshot `artifacts/screenshots/sprint-7-r2-suggestions-shown.png` shows AI-suggested tags in a separate section with emerald dashed-border chips, structurally and visually distinct from the plain text input for user-added tags. Code confirms Tailwind classes `border-dashed border-emerald-500/50 bg-emerald-500/10`. |
| 4 | **"Apply all"** adds every suggested tag | **PASS** | After clicking "Apply all", Tags input changed from `example` → `example, hooks` and the AI Suggested Tags section disappeared entirely (snapshot `page-2026-04-22T10-23-07-014Z.yml`). |
| 5 | **Individual accept (+) and dismiss (×)** | **PASS** | Clicked (+) on "example" → moved to Tags input and removed from suggestions. Clicked (×) on "react" → removed from suggestions without adding to Tags input. Verified via sequential DOM snapshots. |
| 6 | **Loading spinner** while fetching suggestions | **FAIL** | **Unverified — no runtime evidence.** The backend responded in <600ms, making the loading state too brief to observe. An attempt to intercept and delay the request by 2s was initiated via `browser_run_code`, but Playwright MCP crashed before the delayed snapshot could be captured. No snapshot or screenshot ever showed the spinner or "Generating suggestions…" text. |
| 7 | **Re-trigger on title edit** | **PASS** | Edited title from "React hooks guide" → "Advanced React patterns"; clicked button again. Network log shows a new `POST /api/bookmarks/suggest-tags` with body `{"title":"Advanced React patterns",...}` (2nd request in log). |
| 8 | **Fallback without URL metadata** | **PASS** | Live API call `POST /api/bookmarks/suggest-tags` with `{title: "React hooks guide"}` (no URL) returned HTTP 200 + `{"suggested_tags": ["react", "hooks", "guide"]}` — 3 tags derived solely from title. |
| 9 | **Lightweight endpoint contract** | **PASS** | Backend unit tests: 7/7 passed. Live API call with `{title}` returned HTTP 200 + `{"suggested_tags": [...]}`. Live API call with `{title, url, summary}` also returned HTTP 200 + correct schema. |
| 10 | **Tag count enforcement** (3–5 tags) | **PASS** | Backend unit tests cover 1-tag padding → 3, 5-tags kept → 5, 7-tags clamped → 5. All passed. Live API consistently returned 3 tags for title-only requests. |
| 11 | **Tag normalization** | **PASS** | Backend unit test `test_suggest_tags_normalization` passed: input `["AI/ML", "React JS", "CSS3!"]` → output `["ai-ml", "react-js", "css3"]`. |
| 12 | **URL-based caching** | **PASS** | Backend unit test `test_suggest_tags_url_cache_avoids_redundant_llm` passed (mock fetch called once for two identical requests). |
| 13 | **End-to-end creation flow** | **PARTIAL / UNVERIFIED** | Full interactive flow was executed through "apply all" and "re-trigger", but the Playwright MCP crashed **before** the final "Add bookmark" submit step could be performed. No runtime evidence that the bookmark is actually saved after applying suggestions in Round 2. Round 1 reported this as PASS, but it was not re-verified in this round. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 7/10 | 6/10 | **Yes** |
| Functionality | 7/10 | 7/10 | **Yes** |
| Visual Design | 6/10 | 5/10 | **Yes** |
| Code Quality | 5/10 | 5/10 | **Yes** |

**Rationale:**
- **Product Depth:** All core features are present. Gap remains on observable loading-spinner UX.
- **Functionality:** 11/13 criteria pass; #6 is a hard FAIL due to lack of runtime evidence, and #13 is unverified for the final submit step. Backend tests are solid (7/7).
- **Visual Design:** Emerald dashed-border chips are visibly distinct in screenshots. Theming is consistent.
- **Code Quality:** Two Round 1 bugs remain unfixed (silent error swallowing and unbounded cache). This drags the score down to exactly the threshold.

## Regression Check (prior sprints)

| Sprint | Flow Tested | Result | Evidence |
|--------|-------------|--------|----------|
| Sprint 1 | Responsive grid of bookmark cards | **UNVERIFIED** | Playwright MCP crashed before frontend regression could be performed. No DOM snapshot of bookmark grid in this round. |
| Sprint 2 | Bookmark CRUD API | **PASS** | `POST /api/bookmarks` returned 201 with correct JSON payload. `GET /api/bookmarks` returned the created bookmark. |
| Sprint 2 | Tags API | **PASS** | `GET /api/tags` returned `[{"id":"...","name":"qa"},{"id":"...","name":"test"}]` as JSON array. |
| Sprint 3 | `GET /api/bookmarks/{id}/suggested-tags` | **PASS** | Curl returned `{"suggested_tags": ["example"]}` for the newly created bookmark after background enrichment. |
| Sprint 4 | Extension builds + popup flows | **PASS (code)** | `project/extension/dist/` contains `manifest.json`, `popup.js`, `background.js`. Code review confirms popup pre-fills title/URL from active tab and calls `suggestTags(url, title)`. No live browser extension test was performed. |
| Sprint 5 | Collection visibility toggle | **PASS** | `PATCH` visibility → `public_readonly` returned 200. |
| Sprint 5 | Public share link | **PASS** | `POST /api/collections/{id}/share` generated token; `GET /api/public/collections/{token}` returned 200 without auth. |
| Sprint 5 | Share revocation | **PASS** | `DELETE /api/collections/{id}/share` returned 200; subsequent public fetch returned 404. |
| Sprint 6 | `POST /api/bookmarks/fetch-metadata` returns metadata | **PASS** | Curl returned `{"title":"Example Domain","description":"","thumbnail_url":null}` for `https://example.com`. |
| Sprint 6 | URL validation rejects non-http/https | **PASS** | Curl with `ftp://example.com` returned HTTP 422. |
| Sprint 6 | Rate limiting returns 429 | **PASS** | 10 sequential requests returned 200; 11th and 12th returned 429. |

## Bugs Found

1. **[BUG-001] [REGRESSION from Round 1]** `project/src/components/BookmarkModal.tsx:167-178` — `handleSuggestTags` still silently swallows all errors.
   - **Expected:** If the backend returns an error (e.g., 500, network failure, rate limit), the user should see an error message or at least the loading state should clear gracefully with feedback.
   - **Actual:** The `catch` block is empty (`// silently fail`). The loading spinner stops, but the user has no idea why suggestions never appeared.
   - **Root cause:** Empty catch block suppresses all exceptions without UI feedback.
   - **Status:** **NOT FIXED** from Round 1.

2. **[BUG-002] [REGRESSION from Round 1]** `project/backend/app/services/ai_service.py:132` — URL-keyed cache is still an unbounded in-memory dictionary (`_url_cache`).
   - **Expected:** Cache should have an eviction policy or size limit to prevent unbounded memory growth in long-running deployments.
   - **Actual:** `_url_cache` grows indefinitely with every unique URL requested.
   - **Root cause:** No max-size or TTL eviction on the lightweight dict cache.
   - **Status:** **NOT FIXED** from Round 1.

3. **[BUG-003]** Playwright MCP crash on `page.route` interception.
   - **Expected:** Route interception should work reliably to delay network requests for UI state verification.
   - **Actual:** `browser_run_code` with `page.route` succeeded, but the subsequent `browser_click` crashed the MCP server with "Connection closed".
   - **Root cause:** Appears to be an infrastructure/environment issue with the Playwright MCP server, not the application itself. Identical failure mode to Round 1.
   - **Impact:** Loading spinner (criterion #6) could not be verified with runtime evidence for a second consecutive round.

## Overall Verdict: **FAIL**

### Rationale
While **11 of 13** acceptance criteria are functionally correct and the implementation quality is solid in the verified areas, the following issues force a FAIL verdict:

1. **Criterion #6 (Loading spinner)** could not be verified with runtime evidence for a second consecutive round. Per the hard failure rules:
   > "If any acceptance criterion was verified ONLY by reading code (no browser evidence) and it concerns UI/API behavior → mark that criterion as FAIL with reason 'unverified — no runtime evidence'."

2. **Criterion #13 (End-to-end creation flow)** was not fully re-verified in this round because the final "Add bookmark" submit step was never executed before the MCP crash. Round 1 reported it as PASS, but Round 2 lacks the runtime evidence for the complete flow.

3. **Round 1 bugs BUG-001 and BUG-002 remain unfixed.** A QA round whose explicit purpose is to verify bug fixes cannot PASS when reported bugs were not addressed.

4. **Sprint 1 frontend regression** (responsive bookmark grid) could not be verified at all due to the MCP crash, creating an unverified gap in cross-sprint continuity.

## Feedback for Generator

1. **Fix error handling in `BookmarkModal.tsx` (line 167-178):** Replace the silent catch block with user-visible error feedback. At minimum, set an error state and render a small red message below the suggestions area (e.g., "Failed to load suggestions. Try again.").

2. **Add a size-bound to `_url_cache` in `ai_service.py` (line 132):** Convert the unbounded dict to an `OrderedDict` or `functools.lru_cache` wrapper with a reasonable max size (e.g., 1000 entries) to prevent memory leaks in production.

3. **Verify loading spinner manually if infrastructure is unstable:** The loading spinner code is present and looks correct, but generator should test it by throttling the backend or using a slow mock to ensure the DOM element actually renders and is visible to users. Consider adding a short artificial delay in dev mode if needed.

4. **Sprint 1 frontend regression:** Re-verify the responsive bookmark grid renders correctly after the modal changes, as this could not be regression-tested in this session.

5. **Complete end-to-end verification:** Ensure the full "paste URL → fetch metadata → suggest tags → apply suggestions → submit bookmark" flow can be executed without JS errors and that the new bookmark appears in the grid with all applied tags.
