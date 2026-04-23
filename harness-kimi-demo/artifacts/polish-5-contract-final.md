# Polish Sprint 5 Contract — Quality Improvement

## Source
Product Review: artifacts/product-review-epoch-3.md

## Items to Fix

| # | Issue (from backlog) | Priority | Acceptance Criterion |
|---|---------------------|----------|---------------------|
| 1 | **Navigation is broken on mobile and labels are inconsistent** — Mobile (`< 640px`) has no hamburger menu or bottom nav, so users cannot reach Collections, Discover, or Settings. Nav item names change per page (e.g., Home shows "Collections, Discover, Settings" but Collections shows "Library, Discover, Settings"), breaking the user's mental model. | P0 | On mobile viewports, a hamburger icon opens a dropdown/slide-over containing links to Library, Collections, Discover, and Settings. On **all** pages, the header nav displays the **same four labels** regardless of the current route: "Library", "Collections", "Discover", "Settings". The active route receives a visual highlight (e.g., underline or brighter color) but is **not** renamed or hidden. |
| 2 | **Zero feedback during CRUD mutations** — Add, edit, and delete bookmark operations show no loading state, no disabled button, and no success or error message. Users must infer success from the list silently updating. | P0 | In `BookmarkModal.tsx` (add & edit) and the delete flow, the primary action button is **disabled** and shows a spinner or "Saving…" / "Deleting…" text while the async request is in flight. After a successful mutation, a toast (or inline banner) displays: "Bookmark saved", "Changes saved", or "Bookmark deleted". On error, a clear failure message is shown. No new dependencies unless absolutely necessary; prefer a lightweight context + portal or CSS-only toast. |
| 3 | **Duplicate API requests and excessive digest polling** — Every mount fires duplicate `/bookmarks`, `/tags`, and `/digest` calls due to `React.StrictMode` double-mount. The Digest component polls excessively, producing 6+ `/api/digest` requests in a short span. | P1 | Removing `React.StrictMode` from `project/src/main.tsx` (or an equivalent deduplication strategy such as `AbortController` / ref-guard) eliminates duplicate identical requests on page load. Digest data is fetched at most once per mount or cached with a reasonable stale window (e.g., 5 min); no more than one `/api/digest` call appears per user-initiated navigation in the Network tab. |
| 4 | **Sign-up form lacks password confirmation** — A single typo in the password field permanently locks the user out because there is no second field to verify the password. | P1 | `SignupPage.tsx` renders a "Confirm Password" field below the Password field. If the two values do not match on submit, the form blocks the `register()` call and shows an inline error: "Passwords do not match." When they match, registration proceeds normally. No backend changes required. |
| 5 | **Bookmark modal has no inline form validation** — Submitting empty or invalid data (e.g., a malformed URL) produces no feedback; the modal simply does nothing or fails silently. | P1 | In `BookmarkModal.tsx`, the **URL** field validates as a syntactically valid URL before submission. The **Title** field is required. If validation fails, an inline error message appears directly beneath the offending field and the submit button remains disabled (or the submission is blocked). Error messages clear automatically when the user corrects the input. |

## Out of Scope

The following items are intentionally deferred to the next polish sprint. Do **not** implement them here:

- **New features**: AI auto-tag suggestions in the add-bookmark modal; Settings page sections (Change Password, Update Profile, Preferences, Danger Zone); "Generate summary" button.
- **Component extraction**: Extracting a single reusable `BookmarkCard` component across Home, Collections, and Public Collection pages.
- **Visual micro-interactions**: Animations, staggered card entrances, hover lift effects, skeleton screens, or error boundary retry UI.
- **Low-priority polish**: Favicon 404 fallback handler; green status dot tooltip on public collection cards; "show password" toggle; autocomplete attributes on auth forms; username/name field on signup.
- **Settings enhancements**: Any expansion of the barebones Settings page beyond what is listed above.

## Tech Stack

- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI (Python) + SQLite
- All code lives in `project/`
