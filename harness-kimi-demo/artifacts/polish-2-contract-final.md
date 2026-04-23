# Polish Sprint 2 Contract — Quality Improvement

## Source
Product Review: artifacts/product-review-epoch-3.md

## Items to Fix
| # | Issue (from backlog) | Priority | Acceptance Criterion |
|---|---------------------|----------|---------------------|
| 1 | Mobile navigation is completely missing | P0 | At viewport widths < 640px, a hamburger menu button is visible in the header. Tapping it reveals a dropdown or slide-over containing links to Library, Collections, Discover, and Settings. The menu can be dismissed and does not permanently block content. |
| 2 | No loading/success feedback on mutations | P0 | All submit buttons in `BookmarkModal` (Add, Save changes) and the Delete confirmation are disabled and show a spinner / "Saving…" label while the async request is in flight. A toast notification appears on success ("Bookmark saved", "Changes saved", "Bookmark deleted") and on error. |
| 3 | Sign-up form lacks password confirmation and basic accessibility | P1 | Sign-up page has a "Confirm password" field with client-side validation that prevents submission if passwords do not match. Both login and sign-up forms have a show/hide password toggle and correct `autocomplete` attributes (`current-password`, `new-password`, `email`). |
| 4 | Duplicate API requests and excessive digest polling | P1 | React `StrictMode` double-mount is removed or mitigated so `/bookmarks`, `/tags`, and `/digest` fire once per mount. Digest data is cached or fetched at a reasonable rate (no more than 1 call per 5 minutes) instead of firing repeatedly on render. |
| 5 | Navigation labels inconsistent across pages | P1 | Every page header shows the same nav link labels: "Library", "Collections", "Discover", "Settings". The active page is indicated consistently (e.g., highlighted) and is never replaced by a redundant label that breaks the mental model. |

## Out of Scope
- No inline form validation for bookmark fields (e.g., URL format, required title) — defer to next polish sprint
- Settings page expansion / profile management / danger zone — defer to next polish sprint
- Extracting a unified `BookmarkCard` component for all pages — defer to next polish sprint
- AI tag suggestions / surfacing the AI layer — defer to next polish sprint
- Favicon 404 fallback handling or generic globe icon — defer to next polish sprint
- Public collection green dot tooltip or removal — defer to next polish sprint
- 404 page, error boundaries, skeleton screens, animations — defer to next polish sprint
- Any new features not listed above

## Tech Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI (Python) + SQLite
- All code lives in `project/`
