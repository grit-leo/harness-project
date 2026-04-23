# Sprint 6 Contract — Smart URL Capture & Thumbnail Previews

## Scope

### Frontend

| File | Change |
|------|--------|
| `project/src/api/client.ts` | Add `thumbnailUrl?: string` to `Bookmark` and `BookmarkCreate`. Add `fetchMetadata(url: string)` helper and `MetadataFetchResponse` type. |
| `project/src/components/BookmarkModal.tsx` | Integrate metadata fetch on URL `blur` and 800 ms debounce. Show a loading skeleton while fetching. Render a preview card (thumbnail + fetched title + description) before submission. Pre-fill title/summary inputs with fetched values; allow user to edit. Silently swallow fetch failures. |
| `project/src/components/BookmarkCard.tsx` | Render `thumbnail_url` as a top image in 16:9 aspect ratio (`aspect-video object-cover`). Show a fallback gradient placeholder (`bg-gradient-to-br from-slate-800 to-slate-900`) when `thumbnail_url` is absent or the image fails to load. |
| `project/src/App.tsx` | Verify grid layout (`grid-cols-[repeat(auto-fill,minmax(320px,1fr))]`) still works with taller cards; adjust card spacing if needed so filters/search remain unaffected. |

### Backend

| File | Change |
|------|--------|
| `project/backend/app/models/bookmark.py` | Add `thumbnail_url = Column(String(2048), nullable=True)` to the `Bookmark` model. |
| `project/backend/app/schemas/bookmark.py` | Add `thumbnail_url: str | None = None` to `BookmarkCreate`, `BookmarkUpdate`, and `BookmarkOut` (serialized as `thumbnailUrl`). |
| `project/backend/app/routers/bookmarks.py` | Add `POST /api/bookmarks/fetch-metadata` endpoint. Validate URL scheme (`http`/`https`). Apply rate limiting (max 10 requests/minute per user). Call new metadata service. Return `{ title, description, thumbnail_url }` without persisting a bookmark. |
| `project/backend/app/services/metadata_service.py` | **New file.** Accept a URL, fetch HTML with `httpx` (10 s timeout, `User-Agent` header, follow redirects), parse `<title>`, `<meta name="description">`, and `<meta property="og:image">` using `BeautifulSoup4` or robust regex fallback. Return empty strings/`None` for missing fields. Respect fetch failures gracefully (do not raise). |
| Alembic migration | Auto-generate or hand-write a migration that adds `thumbnail_url` to the `bookmarks` table. |
| `project/backend/tests/test_sprint6.py` | **New test file.** Cover endpoint validation, parsing, rate limiting, schema serialization, and fallback behavior. |

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | `POST /api/bookmarks/fetch-metadata` returns JSON with `title`, `description`, and `thumbnail_url` for a valid public URL. | Backend unit test mocks `httpx.get` with sample HTML containing `<title>`, `description`, and `og:image` meta tags and asserts the response matches extracted values. |
| 2 | URL validation rejects schemes other than `http`/`https` with HTTP 422. | Backend test sends `ftp://example.com` and asserts status code 422. |
| 3 | Rate limiting on `fetch-metadata` returns HTTP 429 after >10 requests from the same authenticated user within 60 seconds. | Backend test fires 11 rapid requests and asserts the 11th returns 429. |
| 4 | `thumbnail_url` column exists on `bookmarks` table, is nullable, and does not break existing bookmarks. | Alembic migration applies cleanly on production-like SQLite; existing bookmarks load with `thumbnail_url` as `NULL`. |
| 5 | `BookmarkOut` schema includes `thumbnailUrl` (serialized from `thumbnail_url`) in list and detail responses. | Backend test creates a bookmark with `thumbnail_url="https://example.com/img.png"` and asserts the JSON response contains `"thumbnailUrl": "https://example.com/img.png"`. |
| 6 | `BookmarkCard` renders a 16:9 thumbnail image at the top of the card when `thumbnailUrl` is present. | Visual inspection / Playwright screenshot: card shows image with `aspect-video` container and `object-cover` image. |
| 7 | `BookmarkCard` shows a fallback gradient placeholder (no broken-image icon) when `thumbnailUrl` is missing or the image fails to load. | Visual inspection / Playwright screenshot: card without `thumbnailUrl` displays the gradient block; card with a bad URL shows the gradient block after `onError`. |
| 8 | `BookmarkModal` triggers metadata fetch on URL input blur. | Frontend test / manual: paste a URL, blur the field, network tab shows one `fetch-metadata` call within 1 s. |
| 9 | `BookmarkModal` triggers metadata fetch after 800 ms debounce when typing a valid URL (no blur). | Frontend test / manual: type `https://example.com`, wait 800 ms without blurring, network tab shows exactly one `fetch-metadata` call; rapid typing resets the timer. |
| 10 | While metadata is loading, a loading skeleton (pulsing placeholder) is visible in the modal where the preview card will appear. | Visual inspection / Playwright screenshot: skeleton is visible between request start and response. |
| 11 | After successful fetch, a preview card appears in the modal showing the fetched thumbnail and title, and the title/summary inputs are pre-filled with fetched values. | Manual / automated: enter `https://example.com`, assert preview card renders thumbnail and title, assert title input value equals fetched title. |
| 12 | User can edit the pre-filled title and summary before submitting; the edited values are what get sent to `POST /api/bookmarks`. | Manual / automated: edit title after fetch, submit, assert `createBookmark` payload contains edited title. |
| 13 | If metadata fetch fails (network error, timeout, 4xx/5xx), the modal does **not** show a blocking error toast or modal; the user can still type title and summary manually. | Backend test returns 500 from mock; frontend test asserts no error toast and title input remains editable. |
| 14 | Existing tag-filter, search, and sort behavior remain fully functional after layout changes. | Run existing Playwright or manual tests: filter by tag, search by title, clear filters — results update correctly and cards do not overflow. |
| 15 | Grid layout displays thumbnail cards without clipping or horizontal scroll on 320 px, 768 px, and 1440 px viewports. | Playwright screenshots at three breakpoints show cards fitting within viewport with no horizontal overflow. |

## Out of Scope

- AI tag suggestions inside the Add modal (deferred to Sprint 7).
- Browser extension thumbnail support.
- Backend thumbnail proxying, caching, or storage (only the source URL is stored).
- Video embeds, oEmbed, or rich media beyond static `og:image` thumbnails.
- Deep `robots.txt` parsing with crawl-delay enforcement; we simply skip sites that block our fetch and let the fallback behavior handle it.
- Image optimization (resizing, WebP conversion, CDN).

## Dependencies

- Sprint 1: Responsive grid, `BookmarkCard`, `FilterBar`, search/tag filtering.
- Sprint 2: FastAPI backend, SQLite database, Alembic migrations, JWT auth, `Bookmark` CRUD endpoints.
- Sprint 3: `BookmarkModal` debounce pattern (existing 800 ms timer for tag suggestions can be reused/adapted for metadata fetch).

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLite + Alembic + `httpx` + `beautifulsoup4`
- All previous sprint code is in `project/`
