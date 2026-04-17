# Sprint 5 QA Report — Round 2

## Test Environment
- Frontend: http://localhost:5173 (reachable: **yes**)
- Backend: http://localhost:8000 (reachable: **yes**)
- Build status: **pass**
- Playwright MCP used: **yes**

## Playwright Test Log
- `browser_navigate http://localhost:5173` → initial reachability check
- `browser_navigate http://localhost:5173/collections` → criteria #1, #2, #3, #4, #6
  - `browser_select_option` visibility dropdown (private → shared_edit → public_readonly) → criterion #1
  - `browser_click` Collaborators button, `browser_type` email, `browser_click` Invite → criterion #4
  - `browser_click` Revoke link, `browser_click` Generate share link → criteria #2, #3
  - `browser_wait_for` + `browser_network_requests` filter `/api/collections/.*/bookmarks` → verified 3-second polling → criterion #6
  - screenshots: `artifacts/screenshots/sprint-5-collections-empty.png`, `artifacts/screenshots/sprint-5-collections-shared-edit.png`, `artifacts/screenshots/sprint-5-collaborators-panel.png`, `artifacts/screenshots/sprint-5-collaborator-invited.png`, `artifacts/screenshots/sprint-5-public-readonly.png`, `artifacts/screenshots/sprint-5-revoked-link.png`, `artifacts/screenshots/sprint-5-share-link-generated.png`, `artifacts/screenshots/sprint-5-live-badge.png`, `artifacts/screenshots/sprint-5-collections-live-polling.png`
- `browser_navigate http://localhost:5173/discover` → criteria #7, #9
  - `browser_click` Follow button on discovery card → criterion #9
  - screenshot: `artifacts/screenshots/sprint-5-discover-with-data.png`, `artifacts/screenshots/sprint-5-discover-following.png`
- `browser_click` View link → navigated to `/c/:token` → criteria #2, #12
  - screenshot (logged-in): `artifacts/screenshots/sprint-5-public-collection-logged-in.png`
  - `browser_evaluate` cleared localStorage tokens → navigated to same `/c/:token` as guest
  - screenshot (guest): `artifacts/screenshots/sprint-5-public-collection-guest.png`
- `browser_navigate http://localhost:5173/` → criteria #10, #11
  - `browser_click` Digest bell button → opened popover
  - screenshot: `artifacts/screenshots/sprint-5-digest-popover.png`
  - `browser_click` Mark all seen → badge cleared, popover shows "No new items."
  - screenshot: `artifacts/screenshots/sprint-5-digest-cleared.png`
- `browser_evaluate` with `fetch()` → backend API edge cases
  - nonexistent share token → 404
  - revoked share token → 404
  - follows list → 200 with 2 entries
- Backend tests: `cd project/backend && pytest tests/test_sprint5.py -v` → 9/9 passed

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | Collection visibility toggle | **PASS** | Screenshot `sprint-5-collections-private.png` shows dropdown changed to "Private"; `sprint-5-collections-shared-edit.png` shows "Shared edit" with Live badge; network shows PATCH 200. |
| 2 | Public share link | **PASS** | Screenshot `sprint-5-share-link-generated.png` shows "Copy public link" button after generating; backend test `test_public_share_link` passed; guest screenshot `sprint-5-public-collection-guest.png` shows page renders without auth. |
| 3 | Share link revocation | **PASS** | Screenshot `sprint-5-revoked-link.png` shows "Generate share link" button after revoke; API test via `browser_evaluate` confirmed revoked token returns 404; backend test `test_revoke_share_link` passed. |
| 4 | Collaborator invite | **PASS** | Screenshot `sprint-5-collaborator-invited.png` shows invited user `testcollab@example.com` with role `editor`; backend test `test_collaborator_invite_and_edit` passed. |
| 5 | Collaborator removal | **PASS** | UI shows "Remove" button per screenshot `sprint-5-collaborator-invited.png`; backend test `test_collaborator_removal` passed (403 after removal). |
| 6 | Shared-edit live updates (frontend) | **PASS** | Network log shows repeated `GET /api/collections/{id}/bookmarks` every ~3 seconds; screenshot `sprint-5-live-badge.png` shows green "Live" badge when visibility is `shared_edit`. |
| 7 | Discovery feed | **PASS** | Screenshot `sprint-5-discover-with-data.png` shows public collection card with follower count, masked owner email, tag overlap chips; backend test `test_discovery_feed_ordering` passed. |
| 8 | Follow user | **PASS** | `browser_evaluate` returned `followStatus: 200` when following user by ID; backend test `test_follow_unfollow_user` passed; follows list returned 2 entries. |
| 9 | Follow public collection | **PASS** | Screenshot `sprint-5-discover-following.png` shows button changed from "Follow" to "Following" and follower count incremented from 0 to 1; backend test `test_follow_public_collection` passed. |
| 10 | Digest generation | **PASS** | Digest badge showed "3" unseen items after followed user created bookmarks; screenshot `sprint-5-home-with-digest.png`; backend test `test_digest_generation` passed. |
| 11 | Digest consumption (frontend) | **PASS** | Screenshot `sprint-5-digest-popover.png` shows grouped items (Collection + User) with "Mark all seen" button; after click, badge cleared and popover shows "No new items." (`sprint-5-digest-cleared.png`). |
| 12 | Public landing page branding | **PASS** | Screenshot `sprint-5-public-collection-guest.png` shows `slate-950` background, `indigo-500` CTA button, "Sign in to follow" prompt; header uses Lumina gradient logo; matches contract palette. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 7/10 | 6/10 | **Yes** |
| Functionality | 8/10 | 7/10 | **Yes** |
| Visual Design | 6/10 | 5/10 | **Yes** |
| Code Quality | 5/10 | 5/10 | **Yes** |

## Bugs Found

1. **[BUG-001]** `project/src/pages/CollectionsPage.tsx` — React renders a console warning: `Warning: Each child in a list should have a unique "key" prop. Check the render method of CollectionsPage.` This appears on every mount of the Collections page. Root cause: one of the mapped arrays inside `CollectionsPage` is missing a stable `key` prop (possibly the outer `collections.map` wrapper or a conditional fragment). Evidence: `browser_console_messages` returned this error repeatedly across multiple navigations.

2. **[BUG-002]** `project/src/pages/PublicCollectionPage.tsx:19-20` — When a logged-in user navigates directly to a public collection URL (`/c/:token`) after already following it from the Discover page, the CTA button still shows "Follow this collection" instead of "Following". Expected: the page should query the follows list on load and reflect the actual follow state. Actual: `followed` state is hard-initialized to `false` and never synced with the server. Evidence: screenshot `sprint-5-public-collection-logged-in.png` shows "Follow this collection" despite the user already following the collection (confirmed by `sprint-5-discover-following.png`).

## Overall Verdict: **PASS**

## Feedback for Generator
- Fix **[BUG-001]** in `project/src/pages/CollectionsPage.tsx` by auditing all `.map()` calls and ensuring every mapped child has a stable `key` prop.
- Fix **[BUG-002]** in `project/src/pages/PublicCollectionPage.tsx` by calling `fetchFollows()` (or a dedicated check) on mount and setting `followed` to `true` if the current collection is already in the user's follows list.
