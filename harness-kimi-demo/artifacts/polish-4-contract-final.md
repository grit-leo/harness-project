# Polish Sprint 4 Contract — Quality Improvement

## Source
Product Review: artifacts/product-review-epoch-3.md

## Items to Fix
| # | Issue (from backlog) | Priority | Acceptance Criterion |
|---|---------------------|----------|---------------------|
| 1 | Mobile navigation is completely missing | P0 | At viewport widths <640px, every page (Home, Collections, Discover, Settings, Public Collection) displays a functional hamburger menu that opens a dropdown with Library, Collections, Discover, and Settings links. The menu closes when a link is clicked or when clicking outside. Mobile users can reach every route. |
| 2 | No loading/success feedback on mutations | P0 | All async mutation buttons are disabled and show a spinner during the operation. Toast notifications fire on success ("Bookmark saved", "Changes saved", "Bookmark deleted", "Collection saved", etc.) and on error. Audit CollectionsPage to ensure collection CRUD (create, delete, share, unshare, visibility change) and collaborator actions (invite, remove) also provide toast feedback and loading states. |
| 3 | Duplicate API requests on every mount | P1 | React.StrictMode is removed from main.tsx. Each page fires initial data endpoints exactly once on mount (no duplicate `/bookmarks`, `/tags`, `/collections`, `/digest` calls). The Digest component caches data for at least 5 minutes and does not poll more than once per 5-minute window. |
| 4 | Sign-up lacks password confirmation | P1 | The sign-up form includes a "Confirm password" field with client-side match validation that blocks submission and shows a visible error if passwords differ. Both password fields have a working show/hide toggle. All auth inputs have correct autocomplete attributes (`email`, `new-password`, `current-password`). The submit button is disabled with loading text during the request. |
| 5 | Navigation labels inconsistent across pages | P1 | Every authenticated page shows the exact same four header nav links: Library, Collections, Discover, Settings. The active page is highlighted consistently. No page renames, omits, or reorders links. |

## Out of Scope
- Settings page expansion (Change Password, Profile, Danger Zone, Preferences) — defer to next sprint
- Inline form validation beyond what's already implemented — defer
- Extracting a unified BookmarkCard component — already shared; defer further standardization
- AI tag suggestions wiring — already implemented; defer enhancements
- Favicon 404 error handling — already has onError fallback; defer
- Public collection green dot meaning — defer
- Skeleton screens and animations — defer
- Error boundaries with retry UI — defer
- Network error retry logic — defer
- New features of any kind

## Tech Stack
- Frontend: React 18 + Vite + TypeScript + Tailwind CSS
- Backend: FastAPI (Python) + SQLite
- All code lives in project/
