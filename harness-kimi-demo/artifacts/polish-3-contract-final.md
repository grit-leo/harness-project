# Polish Sprint 3 Contract — Quality Improvement

## Source
Product Review: artifacts/product-review-epoch-3.md

## Items to Fix

| # | Issue (from backlog) | Priority | Acceptance Criterion |
|---|---------------------|----------|---------------------|
| 1 | **Mobile navigation is completely missing** — nav links hidden on `< 640px` with no alternative | P0 | On viewports `< 640px`, a hamburger menu button is visible in the header. Tapping it reveals a dropdown or slide-over containing links to Library, Collections, Discover, and Settings. The menu closes when a link is clicked or when tapping outside. Mobile users can reach every main route. |
| 2 | **No loading/success feedback on mutations** — CRUD operations feel unresponsive | P0 | Submit buttons in `BookmarkModal` (Add bookmark, Save changes, Delete confirm) enter a disabled state with "Saving…" / "Deleting…" text while the API call is in flight. A lightweight toast/notification appears on success ("Bookmark saved", "Changes saved", "Bookmark deleted"). No new dependencies required if avoidable. |
| 3 | **Duplicate API requests on every mount + Excessive Digest API polling** | P1 | Duplicate fetches caused by `React.StrictMode` double-mount are eliminated. The Digest feature stops polling on every render and caches data with a reasonable stale time (e.g., 5 minutes), reducing `/api/digest` calls to at most one per session or per explicit refresh. |
| 4 | **Sign-up lacks password confirmation + No inline form validation** | P1 | The sign-up form gains a "Confirm Password" field with client-side match validation that blocks submission and shows an inline error if passwords differ. `BookmarkModal` fields (URL, Title) have `required` validation and the URL field validates format; empty or invalid submissions are blocked with visible error messages. |
| 5 | **Navigation labels inconsistent across pages + Public collection green dot has no meaning** | P1 | The header navigation always displays the same four labels — Library, Collections, Discover, Settings — regardless of the current page. The active page is indicated consistently (e.g., via underline or highlight) without replacing its label. The green status dot on public collection cards has a tooltip or `aria-label` explaining its meaning (e.g., "Unread"). |

## Out of Scope

The following items are explicitly deferred to the next polish sprint:

- **Card component inconsistency** (P2, Medium effort) — Extracting a single reusable `BookmarkCard` across Home, Collections, and Public Collection pages requires refactoring three separate layouts.
- **Settings page is barebones** (P2, Medium effort) — Adding Change Password, Update Profile, Danger Zone, and Preferences sections is a feature-expansion task, not a polish fix.
- **AI tag suggestions in add modal** (P3, Medium effort) — Wiring the `/suggest-tags` endpoint into `BookmarkModal` is a new feature, not an existing-feature improvement.
- **Favicon 404 fallback** (P3, Low impact) — Adding `onError` handlers to favicon images is low user-visible impact.
- **Skeleton screens / animations / micro-interactions** (P3) — Adding delight moments like staggered card entrances or hover lifts is out of scope for a polish sprint.
- **Error boundary with retry UI** — Not in the top 5 backlog items.
- **Show password toggle on auth forms** — Not in the top 5 backlog items.
- **Autocomplete attributes on login/signup inputs** — Minor accessibility fix, deferred.

## Tech Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI (Python) + SQLite
- All code lives in `project/`
