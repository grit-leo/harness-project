# Polish Sprint 1 Contract — Quality Improvement

## Source
Product Review: artifacts/product-review-epoch-3.md

## Items to Fix

| # | Issue (from backlog) | Priority | Acceptance Criterion |
|---|---------------------|----------|---------------------|
| 1 | **Mobile navigation is completely missing** — On viewports < 640px the nav links are hidden with `hidden sm:block` and there is no hamburger menu or bottom nav, so mobile users cannot reach Collections, Discover, or Settings. | P0 | On viewports < 640px, a hamburger menu button appears in the header. Tapping it opens a dropdown or slide-over containing links to Library, Collections, Discover, and Settings. All routes are reachable on mobile and the menu closes on navigation. |
| 2 | **No loading/success feedback on mutations** — The Add/Edit/Delete bookmark flows have zero feedback: buttons stay enabled during async calls and there is no toast or confirmation after success. | P0 | In `BookmarkModal.tsx`, the primary submit button is disabled and shows a spinner / "Saving…" text while `createBookmark`, `updateBookmark`, or `deleteBookmark` is in flight. After a successful mutation, a brief toast or inline confirmation message appears (e.g., "Bookmark saved", "Changes saved", "Bookmark deleted"). |
| 3 | **Sign-up lacks password confirmation + No inline form validation** — The sign-up form has only one password field (a typo locks the user out) and forms submit without visible validation messages. | P1 | The sign-up page adds a "Confirm password" field; submission is blocked with a visible error if passwords do not match. The bookmark modal adds `required` attributes and inline validation messages: URL must be a valid URL format, title must be non-empty. |
| 4 | **Duplicate API requests on every mount + Excessive Digest polling** — Every page load fires duplicate `/bookmarks`, `/tags`, and `/digest` calls due to React StrictMode double-mount. The Digest component polls excessively (6+ calls observed). | P1 | Remove `React.StrictMode` from `main.tsx` to eliminate dev-only duplicate mounts. Digest data is fetched no more than once per reasonable interval (e.g., cached or fetched on demand) instead of polling on every render. |
| 5 | **Navigation labels inconsistent + Card component inconsistent across pages** — Nav item names change per page (Home shows "Collections, Discover, Settings"; Collections shows "Library, Discover, Settings"; etc.). Cards render with different padding, missing action buttons, and unexplained green dots depending on the page. | P1 | The header navigation always displays the same four labels — Library, Collections, Discover, Settings — regardless of the current route. Bookmark cards use a single consistent layout (padding, action buttons, status indicators) across Home, Collections, and Public Collection pages; the green dot is either removed or given a tooltip/label if it serves a purpose. |

## Out of Scope
[Everything NOT in the table above — defer to next polish sprint]

- Settings page enhancements (profile, password change, preferences, danger zone)
- AI auto-tag suggestions in the add-bookmark modal
- Favicon 404 error fallback handler
- Public collection green dot tooltip (covered if removed in item 5)
- Any new features or major UI redesigns
- Skeleton screens, staggered animations, or hover micro-interactions
- Error boundary with retry buttons
- "Show password" toggle on login/signup forms
- Autocomplete attributes on auth forms

## Tech Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI (Python) + SQLite
- All code lives in project/
