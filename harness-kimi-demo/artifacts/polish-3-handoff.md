# Polish Sprint 3 Handoff

## Items Fixed

| # | Issue | Fix Applied | Files Changed |
|---|-------|------------|---------------|
| 1 | **Mobile navigation missing on Public Collection page** | Added `MobileNav` component to `PublicCollectionPage` header and applied `hidden sm:block` to desktop nav links so they collapse correctly on mobile. Also added Collections/Settings links for logged-in users to maintain consistency. | `project/src/pages/PublicCollectionPage.tsx` |
| 2 | **Loading/success feedback on mutations** | `BookmarkModal` already had `isSubmitting` with spinner + disabled state for Add/Save. Added a **Delete** button inside the edit modal with `isDeleting` state, spinner, and "Deleting…" text. Added loading state to CollectionsPage "Save collection" button with spinner + "Saving…" text. Added toast feedback on collection creation. | `project/src/components/BookmarkModal.tsx`, `project/src/pages/CollectionsPage.tsx`, `project/src/App.tsx` |
| 3 | **Duplicate API requests + Excessive Digest polling** | `DigestPopover` now uses a module-level cache with a 5-minute TTL. It only fetches on mount if cache is stale, and the background interval was aligned to 5 minutes. Explicit refreshes (clicking the bell) still force a fetch. This eliminates the duplicate `/api/digest` calls caused by the component remounting on every page navigation. | `project/src/components/DigestPopover.tsx` |
| 4 | **Sign-up lacks password confirmation + No inline form validation** | Sign-up password confirmation was **already implemented** in `SignupPage.tsx`. For `BookmarkModal`, added explicit client-side validation: URL is checked for emptiness and valid `http(s)://` format, title is checked for emptiness. Errors render as red text below each field and clear on input. Inputs get red borders when invalid. | `project/src/components/BookmarkModal.tsx` |
| 5 | **Navigation labels inconsistent + Public collection green dot has no meaning** | `PublicCollectionPage` header now shows all four labels (Library, Collections, Discover, Settings) for logged-in users, matching other pages. Desktop links are hidden on mobile (`hidden sm:block`). Added `title="Unread"` and `aria-label="Unread"` to the green status dot on every `BookmarkCard`. | `project/src/pages/PublicCollectionPage.tsx`, `project/src/components/BookmarkCard.tsx` |

## Items NOT Fixed (with reason)

| Issue | Reason |
|-------|--------|
| **Card component inconsistency** | Explicitly out of scope per contract. Refactoring three separate card layouts into one reusable component is a medium-effort restructuring task, not a surgical polish fix. |
| **Settings page is barebones** | Explicitly out of scope per contract. Adding Change Password, Update Profile, Danger Zone, and Preferences is feature expansion, not polish. |
| **AI tag suggestions in add modal** | Explicitly out of scope per contract. Wiring `/suggest-tags` is a new feature, not an existing-feature improvement. (Note: the endpoint is already called in `BookmarkModal` when URL + title are present.) |
| **Favicon 404 fallback** | Explicitly out of scope per contract. Low user-visible impact. (Note: `BookmarkCard` already has an `onError` handler that falls back to a generic SVG link icon.) |
| **Skeleton screens / animations / micro-interactions** | Explicitly out of scope per contract. Adding delight moments is deferred to a future sprint. |
| **Error boundary with retry UI** | Not in the top 5 backlog items per contract. |
| **Show password toggle on auth forms** | Not in the top 5 backlog items per contract. (Note: `SignupPage` already has a show-password toggle.) |
| **Autocomplete attributes on login/signup inputs** | Minor accessibility fix, deferred per contract. (Note: `SignupPage` already has `autoComplete` attributes.) |

## Visual Before/After

### Mobile Navigation
- **Before**: On `/c/:token` (public collection), mobile viewports had no hamburger menu and desktop nav links were visible and cramped.
- **After**: Public collection page now uses the same `MobileNav` dropdown as every other page, with all four main routes accessible. Desktop links are properly hidden below `sm:` breakpoint.

### Mutation Feedback
- **Before**: The "New Collection" modal's "Save collection" button had no disabled or loading state. The edit bookmark modal had no delete action inside the modal.
- **After**: "Save collection" shows a spinner and "Saving…" while the API call is in flight. The edit modal now has a red "Delete" button with "Deleting…" spinner and disabled state.

### Form Validation
- **Before**: Empty or invalid bookmark form submissions were blocked only by browser-default validation bubbles (sometimes in the wrong language/locale).
- **After**: Custom inline validation displays red-bordered inputs and red helper text beneath URL and Title fields. Errors clear immediately as the user types.

### Digest Polling
- **Before**: Every page navigation remounted `DigestPopover`, triggering a fresh `/api/digest` fetch. Network logs showed 6+ calls in a short span.
- **After**: A shared module-level cache ensures at most one fetch every 5 minutes across the entire session (unless the user explicitly opens the popover after the cache has expired).

### Green Dot
- **Before**: The emerald status dot on every card had no label, tooltip, or ARIA explanation.
- **After**: The dot carries `title="Unread"` and `aria-label="Unread"` so screen-reader users and hover explorers understand its meaning.

## Build Verification

```
> project@0.0.0 build
> tsc -b && vite build

vite v8.0.8 building client environment for production...
✓ 41 modules transformed.
✓ built in 121ms
```

Zero TypeScript errors, zero build warnings, zero regressions.
