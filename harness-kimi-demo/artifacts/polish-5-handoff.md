# Polish Sprint 5 Handoff

## Items Fixed

| # | Issue | Fix Applied | Files Changed |
|---|-------|-------------|---------------|
| 1 | **Navigation broken on mobile and labels inconsistent** | Mobile hamburger menu (`MobileNav.tsx`) already existed with links to Library, Collections, Discover, and Settings. Labels were already consistent across all pages. Added `useEffect` to auto-close the mobile dropdown on route change to prevent the menu staying open after navigation. | `src/components/MobileNav.tsx` |
| 2 | **Zero feedback during CRUD mutations** | `BookmarkModal.tsx` already had `isSubmitting`/`isDeleting` states with spinners and disabled buttons. Toasts were already wired in `App.tsx` and `CollectionsPage.tsx`. **Fixed a remaining UX bug**: `CollectionsPage.tsx` was reusing `handleDeleteBookmark` (which shows a `confirm()` dialog) for both card-level and modal-level delete. This caused **two consecutive confirm dialogs** when deleting from the modal. Extracted a separate `handleModalDelete` without the redundant `confirm()` so the modal's single confirm (inside `BookmarkModal`) is the only one shown. | `src/pages/CollectionsPage.tsx` |
| 3 | **Duplicate API requests and excessive digest polling** | `React.StrictMode` was already removed from `main.tsx` in prior sprints. DigestPopover already had a 5-minute module-level cache. **Fixed remaining excessive polling**: removed the `setInterval(() => load(), CACHE_TTL_MS)` timer that caused background fetches on every page where the header was mounted. Added an in-flight request guard (`loadingRef`) to `load()` so concurrent calls are deduplicated. Digest now fetches only once per mount (with cache) and once when the popover is explicitly opened. | `src/components/DigestPopover.tsx` |
| 4 | **Sign-up form lacks password confirmation** | Already fully implemented in a prior sprint. `SignupPage.tsx` has a "Confirm Password" field, client-side match validation (`if (password !== confirmPassword)`), and an inline error banner. | *No changes needed* |
| 5 | **Bookmark modal has no inline form validation** | Already fully implemented in a prior sprint. `BookmarkModal.tsx` has a `validate()` function that checks URL syntax (via `new URL()`) and requires Title. Errors render inline with red borders and clear on input change. | *No changes needed* |

## Items NOT Fixed (with reason)

- **Settings page barebones / profile sections** — Explicitly out of scope per the contract.
- **Card component extraction** — Explicitly out of scope per the contract.
- **AI auto-tag suggestions wiring** — Explicitly out of scope per the contract.
- **Favicon 404 fallback handler** — Explicitly out of scope per the contract.
- **Public collection green dot tooltip** — Explicitly out of scope per the contract.
- **Animations / skeleton screens** — Explicitly out of scope per the contract.

## Visual Before/After

### Mobile Navigation
- **Before**: Mobile dropdown could remain open after tapping a link, requiring the user to tap outside to dismiss it.
- **After**: Dropdown automatically closes as soon as the route changes, creating a snappier navigation experience.

### Collections Page Delete Flow
- **Before**: Clicking "Delete" inside the bookmark modal on `/collections` triggered two consecutive `confirm()` dialogs—one from `BookmarkModal` and one from `CollectionsPage`.
- **After**: Only the modal's single confirm dialog appears, matching the behavior on the Home page (`App.tsx`).

### Digest Polling
- **Before**: `DigestPopover` mounted a 5-minute interval on every page header, causing periodic background `/api/digest` requests even when the user was not interacting with the digest feature.
- **After**: No background interval. Data is fetched once on mount (cached) and refreshed only when the user explicitly opens the digest popover.

## Build Verification

```bash
cd project && npm run build
# tsc -b && vite build
# ✓ built in 119ms (no errors, no regressions)
```

## Commit

```
49cb129 Polish 5: fix double confirm in Collections modal, remove digest interval polling, close mobile nav on route change
```
