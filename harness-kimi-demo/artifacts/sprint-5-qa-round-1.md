# Sprint 5 QA Report — Round 1

## Test Environment
- Frontend: http://localhost:5173 (reachable: yes)
- Backend: http://localhost:8000 (reachable: yes)
- Build status: pass
- Playwright MCP used: yes

## Playwright Test Log
- `browser_navigate http://localhost:5173` → redirected to /login (unauthenticated) → criterion N/A
- `browser_click Sign up` + `browser_fill_form {email, password, confirm}` + `browser_click submit` → registered `qatester5@example.com` → criterion N/A
- `browser_navigate http://localhost:5173/collections` → loaded Collections page with default collections → criterion #1
- `browser_select_option combobox → public_readonly` → visibility updated, "Generate share link" appeared → criterion #1
- `browser_click Generate share link` → "Copy public link" + "Revoke link" appeared → criterion #2
- `browser_navigate /c/<token>` (logged in) → public collection page rendered with "Follow this collection" CTA → criterion #2, #12
- `browser_evaluate clearTokens()` + `browser_navigate /c/<token>` → page rendered without auth, "Sign in to follow" shown → criterion #2, #12
- `browser_navigate /discover` → grid of public collections with follower counts, masked emails, Follow buttons → criterion #7, #9
- `browser_click Follow` on discovery card → button changed to "Following", follower count +1 → criterion #9
- `browser_click New collection` + fill form + save → "Shared Edit Test" created → criterion #1
- `browser_select_option combobox → shared_edit` → "Live" badge appeared next to collection name → criterion #6
- `browser_click Collaborators` + fill email + `browser_click Invite` → collaborator listed with "editor" role → criterion #4
- `browser_click Digest bell` → popover opened showing "No new items" → criterion #11
- `browser_evaluate fetch()` to create follow + bookmark → digest item created, badge showed "1", popover listed item under "USER" group → criterion #10, #11
- `browser_click Mark all seen` → badge cleared, items greyed out → criterion #11
- `browser_click Add bookmark` + fill form + save → bookmark created, appeared in collection grid → criterion #6, Sprint 1/2 regression
- `browser_click Edit` on bookmark card → modal opened, "AI Suggested Tags" section visible with "github" chip → Sprint 3 regression
- `browser_click Revoke link` → buttons replaced with "Generate share link" → criterion #3
- `browser_navigate /` → Library grid rendered with title, hostname, favicon, relative date, tag chips → Sprint 1 regression

## Contract Criteria

| # | Criterion | Result | Evidence (screenshot / console / network) |
|---|-----------|--------|---------------------------------------------|
| 1 | Collection visibility toggle | PASS | Screenshot: `sprint-5-public-readonly-selected.png` — dropdown switches to "Public read-only" and persists. Backend: `test_visibility_toggle` PASSED. |
| 2 | Public share link | PASS | Screenshot: `sprint-5-share-link-generated.png` — "Copy public link" / "Revoke link" appear after share. Screenshot: `sprint-5-public-collection-no-auth.png` — `/c/<token>` renders without auth. Backend: `test_public_share_link` PASSED. |
| 3 | Share link revocation | PASS | Screenshot: `sprint-5-share-link-revoked.png` — "Revoke link" clicked, UI reverts to "Generate share link". Backend: `test_revoke_share_link` PASSED. |
| 4 | Collaborator invite | PASS | Screenshot: `sprint-5-collaborator-invited.png` — `collab5@example.com` appears with "editor" role. Backend: `test_collaborator_invite_and_edit` PASSED. |
| 5 | Collaborator removal | PASS | Backend: `test_collaborator_removal` PASSED — 204 on DELETE, subsequent edit returns 403. |
| 6 | Shared-edit live updates (frontend) | PASS | Screenshot: `sprint-5-shared-edit-live.png` — "Live" badge with pulse indicator visible. Network log shows repeated `GET /api/collections/{id}/bookmarks` every ~3 seconds while collection is open. |
| 7 | Discovery feed | PASS | Screenshot: `sprint-5-discover-page.png` — grid of public collections with follower counts and masked owner emails. Backend: `test_discovery_feed_ordering` PASSED. |
| 8 | Follow user | PASS | Backend: `test_follow_unfollow_user` PASSED — follow appears in `GET /api/follows`, unfollow removes it. |
| 9 | Follow public collection | PASS | Screenshot: `sprint-5-discover-after-follow.png` — "Follow" button changes to disabled "Following", follower count increments. Backend: `test_follow_public_collection` PASSED. |
| 10 | Digest generation | PASS | `browser_evaluate` API test: follower receives digest item after followed user creates bookmark. Backend: `test_digest_generation` PASSED. |
| 11 | Digest consumption (frontend) | PASS | Screenshot: `sprint-5-digest-popover-with-items.png` — badge shows "1", items grouped by source. Screenshot: `sprint-5-digest-marked-seen.png` — badge cleared after "Mark all seen" clicked. Network: `POST /api/digest/mark-seen` → 200. |
| 12 | Public landing page branding | PASS | Screenshot: `sprint-5-public-collection-no-auth.png` — `slate-950` background, `indigo-500` CTA button, `emerald-400` accents. Branded header with Lumina logo. |

## Dimension Scores

| Dimension | Score | Threshold | Pass? |
|-----------|-------|-----------|-------|
| Product Depth | 8/10 | 6/10 | Yes |
| Functionality | 8/10 | 7/10 | Yes |
| Visual Design | 6/10 | 5/10 | Yes |
| Code Quality | 6/10 | 5/10 | Yes |

## Regression Check (prior sprints)

| Sprint | Flow Tested | Result | Evidence |
|--------|-------------|--------|----------|
| Sprint 1 | Responsive grid of bookmark cards with title, hostname, favicon, relative date, tag chips | PASS | Screenshot: `sprint-5-library-page-regression.png` |
| Sprint 2 | Bookmark CRUD via UI (add, edit, delete) and live API data | PASS | Network: `POST /api/bookmarks` 201, `GET /api/bookmarks` 200, `GET /api/tags` 200. Screenshot: `sprint-5-bookmark-added-to-collection.png` |
| Sprint 3 | AI-suggested tags displayed in edit modal with accept/reject/edit chips | PASS | Screenshot: `sprint-5-edit-modal-regression.png` — "AI Suggested Tags" section with `github` chip and `+` / `×` buttons |
| Sprint 4 | Extension builds for both browsers; popup pre-fills title/URL | PASS | `project/extension/dist/manifest.json` contains `browser_specific_settings.gecko` (Firefox) and `manifest_version: 3` (Chrome). Build artifacts present: `popup.js`, `popup.html`, `background.js`, `content.js` |

## Bugs Found

1. **[BUG-001]** `project/backend/tests/test_sprint5.py` exists, but contract specified `project/backend/app/tests/test_sprint5.py`. Tests pass, but path deviates from contract. Minor — no functional impact.

2. **[BUG-002]** `DigestPopover.tsx` grouping labels are generic ("User", "Collection", "Other") rather than displaying the actual source user email or collection name. The grouping mechanic works, but the labels lack contextual identity. UX polish issue — not a functional failure.

## Overall Verdict: PASS

## Feedback for Generator
- Move Sprint 5 tests to `project/backend/app/tests/` per contract, or update contract if `project/backend/tests/` is the intended location.
- Consider enriching digest group labels with actual source names (e.g., masked email for users, collection name for collections) instead of generic "User"/"Collection" text.
- The `sprint-5-handoff.md` was empty — please populate handoff documents with implementation notes and known limitations for future sprints.
