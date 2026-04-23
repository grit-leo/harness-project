# Polish Sprint 2 Handoff

## Items Fixed

| # | Issue | Fix Applied | Files Changed |
|---|-------|-------------|---------------|
| 1 | Mobile navigation is completely missing | Created `MobileNav.tsx`: hamburger button (`sm:hidden`) that toggles a dropdown with Library, Collections, Discover, Settings, and Log out. Dismisses on click-outside and link click. Added to all 4 authenticated page headers. | `src/components/MobileNav.tsx` (new), `src/App.tsx`, `src/pages/CollectionsPage.tsx`, `src/pages/DiscoveryPage.tsx`, `src/pages/SettingsPage.tsx` |
| 2 | No loading/success feedback on mutations | Added `isSubmitting` state to `BookmarkModal`: button disabled + spinner + "Saving…"/"Adding…" label. Created global toast system (`Toast.tsx`/`ToastProvider`) with auto-dismiss. Integrated success/error toasts for add, edit, delete in `App.tsx` and add in `CollectionsPage.tsx`. | `src/components/BookmarkModal.tsx`, `src/components/Toast.tsx` (new), `src/main.tsx`, `src/App.tsx`, `src/pages/CollectionsPage.tsx` |
| 3 | Sign-up form lacks password confirmation and basic accessibility | Sign-up: added Confirm password field with client-side match validation. Both login and sign-up: added show/hide password toggle (eye icon) and correct `autocomplete` attributes (`email`, `new-password`, `current-password`). | `src/pages/SignupPage.tsx`, `src/pages/LoginPage.tsx` |
| 4 | Duplicate API requests and excessive digest polling | Removed `React.StrictMode` from `main.tsx` to eliminate dev double-mount. Changed `DigestPopover` polling interval from 10s to 5 minutes (300,000ms). | `src/main.tsx`, `src/components/DigestPopover.tsx` |
| 5 | Navigation labels inconsistent across pages | Standardized every authenticated page header to show the same 4 links: Library, Collections, Discover, Settings. Active page highlighted with `bg-indigo-500/10 text-indigo-300`. Desktop links hidden on mobile (`hidden sm:block`). | `src/App.tsx`, `src/pages/CollectionsPage.tsx`, `src/pages/DiscoveryPage.tsx`, `src/pages/SettingsPage.tsx` |

## Bonus Fix
| Issue | Fix Applied | Files Changed |
|-------|-------------|---------------|
| Edit modal Tags placeholder confusing | When editing, placeholder changed from "design, inspiration, blog" to "Add tags…" so an empty-tags bookmark no longer shows a misleading placeholder. | `src/components/BookmarkModal.tsx` |

## Items NOT Fixed
- **Inline form validation for bookmark fields** — explicitly out of scope per contract.
- **Settings page expansion / profile management / danger zone** — explicitly out of scope per contract.
- **Extracting a unified BookmarkCard component** — explicitly out of scope per contract.
- **AI tag suggestions surfacing** — explicitly out of scope per contract.
- **Favicon 404 fallback handling** — explicitly out of scope per contract.
- **Public collection green dot tooltip** — explicitly out of scope per contract.
- **404 page, error boundaries, skeleton screens, animations** — explicitly out of scope per contract.

## Visual Before/After

### Mobile Navigation
- **Before**: At <640px, all nav links vanished with `hidden sm:block` and no alternative was provided. Mobile users could not reach Collections, Discover, or Settings.
- **After**: A hamburger menu appears on every authenticated page. Tapping it reveals a dropdown with all nav links + logout, highlighted active state, and click-outside dismissal.

### Mutation Feedback
- **Before**: Clicking "Add bookmark" or "Save changes" gave zero visual feedback. The modal closed only after the network request finished, leaving users unsure if anything happened.
- **After**: The primary action button disables, dims, and shows a spinning loader + "Saving…"/"Adding…" text. A green toast appears on success ("Bookmark saved", "Changes saved", "Bookmark deleted"); a red toast appears on error.

### Auth Forms
- **Before**: Sign-up had a single password field (typos = lockout). No password visibility toggle. Console warnings for missing `autocomplete` attributes.
- **After**: Sign-up has a Confirm password field with live mismatch validation. Both forms have an eye-icon toggle to show/hide passwords. All inputs have correct `autocomplete` values.

### Navigation Consistency
- **Before**: Home showed "Collections, Discover, Settings" (no Library). Collections showed "Library, Discover, Settings" (no Collections). Each page replaced its own name with nothing, breaking the mental model.
- **After**: Every page shows the same 4 labels. The active page is always present and highlighted in indigo, so users always know where they are.

### Performance
- **Before**: React StrictMode caused every `useEffect` to fire twice in dev, doubling `/bookmarks`, `/tags`, and `/digest` requests. Digest polled every 10 seconds.
- **After**: StrictMode removed → single fetch per mount. Digest polls every 5 minutes, eliminating excessive network traffic.

## Build Verification
```
cd project && npm run build
# ✓ tsc -b && vite build
# ✓ built in 98ms
```

## Commit
```
1eede24 Polish 2: mobile nav, loading toasts, auth accessibility, dedupe API, consistent nav labels
```
