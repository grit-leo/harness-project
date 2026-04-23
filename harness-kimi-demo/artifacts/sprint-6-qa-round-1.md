# Sprint 6 QA Report — Round 1

## Test Environment
- Frontend: http://localhost:5173 (reachable: yes)
- Backend: http://localhost:8000 (reachable: yes)
- Build status: pass
- Playwright MCP used: yes (crashed mid-session during skeleton test; substantial evidence collected prior to crash)

## Playwright Test Log
- `browser_navigate http://localhost:5173` → redirected to /login
- `browser_fill_form` signup + `browser_click submit` → authenticated session established
- `browser_click Add bookmark` + `browser_type URL` + `browser_click Title` → criteria #8, #11
  - screenshot: `artifacts/screenshots/sprint-6-modal-after-blur.png`
- `browser_click Cancel` → reset modal
- `browser_click Add bookmark` + `browser_type URL (httpbin.org/html)` + `browser_wait_for 1.5s` → criterion #9
- `browser_evaluate` create test bookmarks (with/without/broken thumbnail) → criteria #6, #7
- `browser_navigate http://localhost:5173/` + `browser_take_screenshot` → criteria #6, #7
  - screenshot: `artifacts/screenshots/sprint-6-cards-rendered.png`
- `browser_resize 320x800` + `browser_take_screenshot` → criterion #15
  - screenshot: `artifacts/screenshots/sprint-6-viewport-320.png`
- `browser_resize 768x900` + `browser_take_screenshot` → criterion #15
  - screenshot: `artifacts/screenshots/sprint-6-viewport-768.png`
- `browser_resize 1440x900` + `browser_take_screenshot` → criterion #15
  - screenshot: `artifacts/screenshots/sprint-6-viewport-1440.png`
- `browser_click blog tag` + `browser_take_screenshot` → criterion #14
  - screenshot: `artifacts/screenshots/sprint-6-tag-filter.png`
- `browser_type "Without Thumbnail"` in search + `browser_take_screenshot` → criterion #14
  - screenshot: `artifacts/screenshots/sprint-6-search-filter.png`
- `browser_click Clear all filters` + `browser_take_screenshot` → criterion #14
  - screenshot: `artifacts/screenshots/sprint-6-after-clear.png`
- `browser_run_code` page.route delay for fetch-metadata → intended for criterion #10 (Playwright crashed before screenshot)
- Backend API verification via `curl` + `pytest` → criteria #1, #2, #3, #4, #5, #13

## Contract Criteria

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `POST /api/bookmarks/fetch-metadata` returns JSON with `title`, `description`, and `thumbnail_url` for a valid public URL. | **PASS** | Backend test `test_fetch_metadata_success` passes. `curl` to endpoint with `https://example.com` returned `{"title":"Example Domain","description":"","thumbnail_url":null}` (example.com has no og:image). |
| 2 | URL validation rejects schemes other than `http`/`https` with HTTP 422. | **PASS** | Backend test `test_fetch_metadata_rejects_ftp` passes. `curl` with `ftp://example.com` returned HTTP 422. |
| 3 | Rate limiting on `fetch-metadata` returns HTTP 429 after >10 requests from the same authenticated user within 60 seconds. | **PASS** | Backend test `test_fetch_metadata_rate_limit` passes. `curl` loop: requests 1-10 returned 200, request 11 returned 429. |
| 4 | `thumbnail_url` column exists on `bookmarks` table, is nullable, and does not break existing bookmarks. | **PASS** | Alembic migration `257ac2d3ebd6_add_thumbnail_url_to_bookmarks.py` applies column as `String(2048), nullable=True`. Backend test `test_existing_bookmark_has_null_thumbnail_url` passes. |
| 5 | `BookmarkOut` schema includes `thumbnailUrl` (serialized from `thumbnail_url`) in list and detail responses. | **PASS** | Backend test `test_bookmark_out_includes_thumbnail_url` passes. `curl` PATCH with `thumbnail_url` returns `"thumbnailUrl": "https://example.com/img.png"`. |
| 6 | `BookmarkCard` renders a 16:9 thumbnail image at the top of the card when `thumbnailUrl` is present. | **PASS** | Screenshot `sprint-6-cards-rendered.png` shows "Article With Thumbnail" card displaying a `picsum.photos` image in a 16:9 container. |
| 7 | `BookmarkCard` shows a fallback gradient placeholder (no broken-image icon) when `thumbnailUrl` is missing or the image fails to load. | **PASS** | Screenshot `sprint-6-cards-rendered.png` shows gradient placeholder on "Article Without Thumbnail" and on "Article With Broken Thumbnail" (after `onError`). Console shows `ERR_NAME_NOT_RESOLVED` for broken URL, but UI displays gradient fallback. |
| 8 | `BookmarkModal` triggers metadata fetch on URL input blur. | **PASS** | Network log shows `POST /api/bookmarks/fetch-metadata` immediately after blurring URL field. Screenshot `sprint-6-modal-after-blur.png` shows preview card with "Example Domain" and title pre-filled. |
| 9 | `BookmarkModal` triggers metadata fetch after 800 ms debounce when typing a valid URL (no blur). | **PASS** | Network log shows exactly one `fetch-metadata` request 1.5s after typing `https://httpbin.org/html` without blurring. No duplicate requests observed for this test. |
| 10 | While metadata is loading, a loading skeleton (pulsing placeholder) is visible in the modal where the preview card will appear. | **PARTIAL** | Code inspection confirms skeleton exists (`animate-pulse` divs in `BookmarkModal.tsx`). Playwright MCP crashed before a delayed-route screenshot could be captured. No direct runtime screenshot of skeleton state. |
| 11 | After successful fetch, a preview card appears in the modal showing the fetched thumbnail and title, and the title/summary inputs are pre-filled with fetched values. | **PASS** | Screenshot `sprint-6-modal-after-blur.png` shows preview card with "Example Domain" and title input pre-filled with "Example Domain". |
| 12 | User can edit the pre-filled title and summary before submitting; the edited values are what get sent to `POST /api/bookmarks`. | **PASS with BUG** | Editing works and edited values are sent. However, the `thumbnailUrl` field sent by the frontend is **ignored by the backend** because `BookmarkCreate`/`BookmarkUpdate` schemas lack alias handling for `thumbnailUrl` (see BUG-001). The thumbnail metadata is lost on submission. |
| 13 | If metadata fetch fails (network error, timeout, 4xx/5xx), the modal does not show a blocking error toast or modal; the user can still type title and summary manually. | **PASS** | Backend test `test_metadata_service_returns_empty_on_timeout` passes. `curl` to `fetch-metadata` with unresolvable domain returned HTTP 200 with empty payload. Frontend `fetchMetadata` catches non-OK responses and returns empty result silently. No error toast or blocking UI. |
| 14 | Existing tag-filter, search, and sort behavior remain fully functional after layout changes. | **PASS** | Screenshots `sprint-6-tag-filter.png`, `sprint-6-search-filter.png`, and `sprint-6-after-clear.png` demonstrate tag filtering, search, and clear-all working correctly. Cards do not overflow. |
| 15 | Grid layout displays thumbnail cards without clipping or horizontal scroll on 320 px, 768 px, and 1440 px viewports. | **PASS** | Screenshots `sprint-6-viewport-320.png`, `sprint-6-viewport-768.png`, and `sprint-6-viewport-1440.png` show cards fitting within each viewport with no horizontal overflow. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 7/10 | 6/10 | Yes |
| Functionality | 7/10 | 7/10 | Yes (borderline — BUG-001 is a data-loss bug) |
| Visual Design | 6/10 | 5/10 | Yes |
| Code Quality | 5/10 | 5/10 | Yes (borderline — schema mismatch is a basic integration gap) |

## Regression Check (prior sprints)

| Sprint | Flow Tested | Result | Evidence |
|--------|-------------|--------|----------|
| Sprint 1 | Responsive grid of bookmark cards with favicon, hostname, relative date, clickable tag chips | **PASS** | Screenshot `sprint-6-cards-rendered.png` shows 3 cards with all required elements. |
| Sprint 2 | Bookmark CRUD API (`GET`, `POST`, `PATCH`, `DELETE`) + Tags API (`GET /api/tags`) | **PASS** | `curl` tests: GET list OK, POST create OK, PATCH update OK (title changed), DELETE returned 204. `GET /api/tags` returned 4 tags. Frontend grid loads live data. |
| Sprint 3 | AI-suggested tags endpoint (`GET /api/bookmarks/{id}/suggested-tags`) | **PASS** | `curl` to suggested-tags endpoint returned `{"suggested_tags":["camelcase-test"]}`. Frontend modal also displayed AI tag chip "example" during blur test. |
| Sprint 4 | Extension builds + popup pre-fill + popup AI tags | **UNVERIFIED** | Not tested — requires extension build environment and is outside Sprint 6 scope. No regressions detected in core app. |
| Sprint 5 | Collection visibility toggle, public share link, share revocation | **PASS** | `curl` tests: PATCH visibility to `public_readonly` OK, POST share returned token, GET public collection OK, DELETE share returned 200, subsequent GET returned 404. |

## Bugs Found

1. **[BUG-001]** `project/backend/app/schemas/bookmark.py:7-20` — `BookmarkCreate` and `BookmarkUpdate` schemas do not accept the `thumbnailUrl` field sent by the frontend.
   - **Expected:** When the frontend sends `thumbnailUrl: "https://example.com/img.png"` in a `POST /api/bookmarks` request, the value should be parsed and persisted.
   - **Actual:** Pydantic v2 ignores the unknown `thumbnailUrl` field; `thumbnail_url` defaults to `None`. The created bookmark always has `thumbnailUrl: null` regardless of what the frontend sends.
   - **Root cause:** `BookmarkCreate` and `BookmarkUpdate` define `thumbnail_url: str | None = None` without any `alias`, `validation_alias`, or `populate_by_name=True` configuration. The frontend consistently uses camelCase (`thumbnailUrl`) per the TypeScript interfaces in `src/api/client.ts`.
   - **Evidence:** 
     - `curl` test: `POST /api/bookmarks` with body `{"url":"...","title":"...","thumbnailUrl":"https://example.com/img.png"}` → response `"thumbnailUrl": null`.
     - `curl` test: same request with `thumbnail_url` (snake_case) → response `"thumbnailUrl": "https://example.com/img.png"`.
     - Code: `BookmarkOut` has alias handling, but `BookmarkCreate` and `BookmarkUpdate` do not.

2. **[BUG-002]** `project/src/components/BookmarkModal.tsx:137-139` — Potential duplicate metadata fetch when `onBlur` fires while a debounce timer is still active.
   - **Expected:** Only one `fetch-metadata` request should fire per user interaction (either blur OR debounce, never both).
   - **Actual:** During initial blur testing, the network log showed two `POST /api/bookmarks/fetch-metadata` requests for `https://example.com` after a single blur interaction. This suggests a race condition where the debounce timer and blur handler may both execute.
   - **Root cause:** `handleUrlBlur` reads `url` from React state, which may not be synchronized with the `value` parameter in `handleUrlChange` if events fire in rapid succession. Additionally, `debounceTimerRef.current` is cleared but the closure inside `setTimeout` may still reference a stale `value`.
   - **Evidence:** Network log excerpt showing two identical `fetch-metadata` requests after one blur event:
     ```
     [POST] http://localhost:8000/api/bookmarks/fetch-metadata => [200] OK
       Request body: {"url":"https://example.com"}
     [POST] http://localhost:8000/api/bookmarks/fetch-metadata => [200] OK
       Request body: {"url":"https://example.com"}
     ```
   - **Note:** This was not reproducible in the second debounce test (only one request fired). The race may be timing-dependent.

## Overall Verdict: **FAIL**

While 13 of 15 contract criteria pass (or pass with notes), **BUG-001 is a data-loss defect that directly undermines the core Sprint 6 feature**: a user fetches metadata, sees a thumbnail preview, edits the title, submits the bookmark, and the thumbnail is silently discarded. The backend thinks it is persisting `thumbnail_url`, but the schema mismatch means the frontend's `thumbnailUrl` never reaches the database. This is not a minor edge case; it breaks the primary user flow of "Smart URL Capture & Thumbnail Previews" end-to-end.

## Feedback for Generator

1. **Fix BUG-001 immediately** in `project/backend/app/schemas/bookmark.py`:
   - Add alias handling to `BookmarkCreate` and `BookmarkUpdate` for `thumbnail_url` so it accepts both `thumbnail_url` (snake_case) and `thumbnailUrl` (camelCase). For example:
     ```python
     class BookmarkCreate(BaseModel):
         ...
         thumbnail_url: str | None = Field(default=None, alias="thumbnailUrl")
         model_config = ConfigDict(populate_by_name=True)
     ```
   - Alternatively, add a `field_validator` or `@model_validator` to normalize `thumbnailUrl` → `thumbnail_url`.
   - After fixing, verify end-to-end: create a bookmark via the frontend modal with a URL that returns an `og:image`, submit, and confirm the card renders the thumbnail.

2. **Investigate BUG-002** in `project/src/components/BookmarkModal.tsx`:
   - Ensure `handleUrlBlur` definitively prevents the debounce timer from firing. Consider using a `useRef` flag (e.g., `blurFiredRef`) that the debounce callback checks before executing.
   - Add a guard in the `setTimeout` callback: if `blurFiredRef.current === true`, skip the fetch.

3. **Criterion #10 — Loading skeleton**:
   - The skeleton is implemented in code, but no runtime screenshot was captured due to the Playwright crash. Re-test after fixes to confirm the skeleton is visible for at least one frame during a slow metadata fetch.

4. **Sprint 4 regression**:
   - Extension builds were not tested. If Sprint 4 functionality is still required, run the extension build scripts (`npm run build:chrome` / `npm run build:firefox` or equivalent) and verify the popup behavior.
