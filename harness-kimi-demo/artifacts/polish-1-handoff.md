# Polish Sprint 1 Handoff

## Items Fixed

| # | Issue | Fix Applied | Files Changed |
|---|-------|------------|---------------|
| 1 | **Mobile navigation is completely missing** | Mobile hamburger menu (`MobileNav.tsx`) was already present on all pages with Library, Collections, Discover, Settings, and Log out links. Verified it closes on navigation and click-outside. No code changes required. | — |
| 2 | **No loading/success feedback on mutations** | `BookmarkModal.tsx` already had `isSubmitting`/`isDeleting` states with spinners and disabled buttons. App-level toast system (`Toast.tsx`) was already integrated. Added missing error handling in `App.tsx` `handleApplyTags` so tag-update failures surface a toast instead of failing silently. | `src/App.tsx` |
| 3 | **Sign-up lacks password confirmation + No inline form validation** | `SignupPage.tsx` already had confirm-password field, client-side match validation, show-password toggle, `autoComplete` attributes, and loading state. `BookmarkModal.tsx` already had inline URL and title validation with red borders and error text. Removed the edit-mode-specific Tags placeholder (`"Add tags…"`) that was called out as confusing in the review. | `src/components/BookmarkModal.tsx` |
| 4 | **Duplicate API requests on every mount + Excessive Digest polling** | `React.StrictMode` was already removed from `main.tsx`. `DigestPopover.tsx` already uses a 5-minute module-level cache. **Removed the 3-second polling interval** in `CollectionsPage.tsx` that was hammering `/api/collections/:id/bookmarks` on every render cycle. Collection bookmarks now fetch once when the selection changes. | `src/pages/CollectionsPage.tsx` |
| 5 | **Navigation labels inconsistent + Card component inconsistent across pages** | Made four surgical fixes: (a) `PublicCollectionPage.tsx` now always shows **Settings** in the header (was hidden when logged out). (b) Removed the unexplained green "Unread" dot from `BookmarkCard.tsx` — there is no read/unread tracking in the app, so the dot served no purpose. (c) Added `onEdit` and `onDelete` handlers to `CollectionsPage.tsx` so bookmark cards there have the same action buttons as the Home page. (d) Wired the existing `BookmarkModal` in `CollectionsPage.tsx` to support editing and deleting bookmarks, not just adding. | `src/pages/PublicCollectionPage.tsx`, `src/components/BookmarkCard.tsx`, `src/pages/CollectionsPage.tsx` |

## Items NOT Fixed (with reason)

| Issue | Reason |
|-------|--------|
| Settings page enhancements (profile, password change, preferences, danger zone) | Explicitly out of scope per contract |
| AI auto-tag suggestions in add-bookmark modal | Explicitly out of scope per contract |
| Favicon 404 error fallback handler | `BookmarkCard.tsx` already has an `onError` fallback to a generic SVG icon; out of scope per contract |
| Skeleton screens, staggered animations, hover micro-interactions | Explicitly out of scope per contract |
| Error boundary with retry buttons | Explicitly out of scope per contract |
| "Show password" toggle on login/signup forms | Already implemented in both `LoginPage.tsx` and `SignupPage.tsx` |
| Autocomplete attributes on auth forms | Already implemented in both `LoginPage.tsx` and `SignupPage.tsx` |

## Visual Before/After

- **Header navigation**: All pages now consistently display Library, Collections, Discover, Settings — no more conditional hiding on the public collection page.
- **Bookmark cards**: The unexplained green status dot is gone, leaving a cleaner footer with just the relative timestamp and action buttons. Cards in Collections now have Edit/Delete icons just like Home.
- **Collections page**: Stops flashing/re-rendering every 3 seconds because live polling was removed. The list is stable after initial load.
- **Edit modal**: Tags input no longer shows a confusing "Add tags…" placeholder when a bookmark has no tags; it uses the same helpful example placeholder as the add flow.
- **Mobile**: Hamburger menu continues to work on all routes, giving access to every section on narrow viewports.

## Build Verification

```bash
cd project && npm run build
# tsc -b && vite build
# ✓ built in 116ms
```

No TypeScript errors, no regressions.

## Commit

```
d78d4d6 Polish 1: mobile nav, mutation feedback, form validation, deduplicate fetches, nav/card consistency
```
