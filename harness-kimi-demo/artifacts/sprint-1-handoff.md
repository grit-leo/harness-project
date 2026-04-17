# Sprint 1 Handoff — Bug Fixes (QA Round 1)

## Summary
All five bugs identified in the QA Round 1 report have been fixed and the production build passes successfully.

## Fixes Applied

| Bug | File | Change |
|-----|------|--------|
| **BUG-001** — Desktop card width violates 320px minimum | `src/App.tsx` | Replaced rigid breakpoint grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`) with `grid-cols-[repeat(auto-fill,minmax(320px,1fr))]` so cards never shrink below 320px. |
| **BUG-002** — Missing favicon/thumbnail placeholder | `src/components/BookmarkCard.tsx` | Replaced the hostname-initials avatar with a favicon image using Google’s favicon service (`https://www.google.com/s2/favicons?domain=${hostname}&sz=64`). Includes an SVG link-icon fallback on error. |
| **BUG-003** — React 19 installed instead of React 18 | `package.json` | Downgraded `react` and `react-dom` from `^19.2.4` to `^18.3.1`. Also updated `@types/react` and `@types/react-dom` to compatible 18.x versions, then ran `npm install`. |
| **BUG-004** — Undefined CSS utility `scrollbar-hide` | `src/components/FilterBar.tsx` | Removed the unused `scrollbar-hide` class from the tag-scroll container. |
| **BUG-005** — Dead/unused CSS file | `src/App.css` | Deleted the unused file. |

## Build Verification

```bash
cd project && npm install && npm run build
```

**Result:** ✅ Type-check and Vite build both pass with zero errors.

```
dist/index.html                   0.78 kB │ gzip:  0.44 kB
dist/assets/index-gC-wX1y_.css   25.89 kB │ gzip:  5.22 kB
dist/assets/index-C2HBD-L6.js   157.88 kB │ gzip: 51.43 kB
```

## Acceptance Criteria Status
All 7 Sprint 1 contract acceptance criteria are now expected to pass:
1. Responsive bookmark card grid (min 320px width).
2. Cards show title, hostname, favicon placeholder, relative date, and clickable tags.
3. Mock data contains ≥24 bookmarks and 8–12 unique tags with correct schema.
4. Tag chips toggle OR-logic filtering in real time.
5. Search filters by substring match on title or tag name.
6. Active filters are highlighted and clearable with a single action.
7. Zero backend dependencies; builds to static assets only.
