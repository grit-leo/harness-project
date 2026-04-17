# Sprint 5 Contract — Collaboration & Discovery

## Scope

### Backend (FastAPI + SQLite)
1. **Schema migrations** (`project/backend/alembic/versions/`)
   - Add `visibility` enum column (`private` | `public_readonly` | `shared_edit`) and `share_token` (nullable, unique) to `collections`.
   - Add `collection_collaborators` join table (`collection_id`, `user_id`, `role` default `editor`).
   - Add `follows` table (`id`, `follower_id`, `following_user_id` nullable, `following_collection_id` nullable, `created_at`).
   - Add `digest_items` table (`id`, `user_id`, `source_user_id` nullable, `source_collection_id` nullable, `bookmark_id`, `seen` boolean default false, `created_at`).

2. **Models** (`project/backend/app/models/`)
   - Update `collection.py` with `visibility` and `share_token`.
   - Add `collection_collaborator.py`.
   - Add `follow.py`.
   - Add `digest_item.py`.

3. **Schemas** (`project/backend/app/schemas/`)
   - Extend `CollectionOut` / `CollectionUpdate` with `visibility` and `shareToken`.
   - Add `CollaboratorOut`, `FollowOut`, `PublicCollectionOut`, `DigestItemOut`.

4. **API Routers**
   - `project/backend/app/routers/collections.py`:
     - `POST /api/collections/{id}/share` — toggles `share_token` and returns public URL.
     - `DELETE /api/collections/{id}/share` — revokes public link.
     - `GET /api/collections/{id}/collaborators`
     - `POST /api/collections/{id}/collaborators` — invite by email; creates user stub if missing.
     - `DELETE /api/collections/{id}/collaborators/{user_id}`
   - `project/backend/app/routers/public.py` (new router):
     - `GET /api/public/collections/{share_token}` — unauthenticated read of a public collection and its bookmarks.
     - `POST /api/public/collections/{share_token}/follow` — authenticated users can follow a public collection.
   - `project/backend/app/routers/discover.py` (new router):
     - `GET /api/discover` — returns public collections sorted by follower count and tag overlap with the current user.
   - `project/backend/app/routers/follows.py` (new router):
     - `POST /api/users/{user_id}/follow` / `DELETE /api/users/{user_id}/follow`
     - `GET /api/follows` — list who the current user follows.
   - `project/backend/app/routers/digest.py` (new router):
     - `GET /api/digest` — returns unseen digest items for the current user, grouped by source, oldest first, max 50.
     - `POST /api/digest/mark-seen` — marks returned items as seen.
   - `project/backend/app/routers/bookmarks.py`:
     - Update create/update/delete guards so that a user with `shared_edit` collaborator role on the collection’s owner can mutate bookmarks that match the collection’s rules.

5. **Services** (`project/backend/app/services/`)
   - Add `digest_service.py`:
     - `generate_digest_items()` — called after a bookmark is created; inserts unseen digest rows for all followers of the owner and all followers of any shared collection the bookmark belongs to.

6. **Tests**
   - `project/backend/app/tests/test_sprint5.py` covering:
     - visibility toggle & share token generation/revocation,
     - public collection read without auth,
     - collaborator invite & removal,
     - shared-edit authorization for bookmark mutations,
     - discovery feed ordering,
     - follow/unfollow users & collections,
     - digest generation and mark-seen.

### Frontend (React 18 + Vite + TypeScript + Tailwind CSS)
1. **API client** (`project/src/api/client.ts`)
   - Add functions: `shareCollection`, `unshareCollection`, `fetchCollaborators`, `inviteCollaborator`, `removeCollaborator`, `fetchPublicCollection`, `followPublicCollection`, `fetchDiscovery`, `followUser`, `unfollowUser`, `fetchFollows`, `fetchDigest`, `markDigestSeen`.

2. **Pages & Routes** (`project/src/App.tsx`)
   - Add route `/discover` → `Discovery.tsx`.
   - Add route `/c/:token` → `PublicCollection.tsx` (unauthenticated accessible; hidden follow button requires auth).
   - Add "Discover" nav link in the header.

3. **Components / Pages**
   - `project/src/pages/Collections.tsx` (updates):
     - Visibility toggle dropdown (private / public read-only / shared edit) per collection.
     - "Copy public link" / "Revoke link" buttons for public collections.
     - Collaborator management panel: invite by email, list collaborators, remove collaborator.
     - Live indicator for shared-edit collections: poll bookmarks every 3 seconds when a shared-edit collection is selected and show a "Live" badge.
   - `project/src/pages/Discovery.tsx` (new):
     - Grid of public collections from `GET /api/discover`.
     - Each card shows name, owner email (masked), follower count, tag overlap chips, and Follow button.
   - `project/src/pages/PublicCollection.tsx` (new):
     - Branded landing page using the Lumina color palette (`slate-950` background, `indigo-500` accents).
     - Displays collection name, description, rules, and matching bookmarks as read-only cards.
     - "Follow this collection" CTA for logged-in users; sign-in prompt for guests.
   - `project/src/components/DigestPopover.tsx` (new):
     - Header bell icon with unseen-count badge.
     - Dropdown listing recent digest items grouped by source user/collection.
     - "Mark all seen" button.

## Acceptance Criteria

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | **Collection visibility toggle** — A collection owner can PATCH the collection to `private`, `public_readonly`, or `shared_edit`, and the backend persists the change. | Run `test_sprint5.py::test_visibility_toggle` — asserts 200 response and correct DB value. |
| 2 | **Public share link** — When a collection is set to `public_readonly`, `POST /api/collections/{id}/share` generates a unique `share_token`; the link `/c/{token}` renders the public landing page without authentication. | Run `test_sprint5.py::test_public_share_link`; manual browser visit to `/c/<token>` in incognito mode shows the page. |
| 3 | **Share link revocation** — `DELETE /api/collections/{id}/share` clears the token and subsequent public requests return 404. | Run `test_sprint5.py::test_revoke_share_link`. |
| 4 | **Collaborator invite** — An owner can POST a collaborator by email; the invitee appears in `GET /api/collections/{id}/collaborators` and can mutate bookmarks that match the collection rules. | Run `test_sprint5.py::test_collaborator_invite_and_edit`. |
| 5 | **Collaborator removal** — An owner can DELETE a collaborator; the removed user can no longer mutate the owner’s bookmarks. | Run `test_sprint5.py::test_collaborator_removal`. |
| 6 | **Shared-edit live updates (frontend)** — When a shared-edit collection is open in `Collections.tsx`, the UI polls its bookmarks every 3 seconds and reflects changes without a manual refresh. | Playwright/manual test: open collection in two browsers, add a bookmark in one, verify it appears in the other within 5 seconds. |
| 7 | **Discovery feed** — `GET /api/discover` returns public collections ordered primarily by follower count descending and secondarily by tag overlap with the caller. | Run `test_sprint5.py::test_discovery_feed_ordering`. |
| 8 | **Follow user** — An authenticated user can follow another user; the follow appears in `GET /api/follows` and unfollow removes it. | Run `test_sprint5.py::test_follow_unfollow_user`. |
| 9 | **Follow public collection** — An authenticated user can follow a public collection via `POST /api/public/collections/{token}/follow`; it appears in `GET /api/follows`. | Run `test_sprint5.py::test_follow_public_collection`. |
| 10 | **Digest generation** — When a followed user creates a new bookmark, a digest item is created for every follower. When a bookmark is added to a followed public/shared collection, followers of that collection receive a digest item. | Run `test_sprint5.py::test_digest_generation`. |
| 11 | **Digest consumption (frontend)** — The digest popover in the header shows unseen items; clicking "Mark all seen" clears the badge and updates the backend. | Playwright/manual test: create bookmark as followed user, refresh follower page, verify badge count > 0, click mark-seen, badge resets. |
| 12 | **Public landing page branding** — The unauthenticated `/c/:token` page uses the existing Lumina color palette (`slate-950`, `indigo-500`, `emerald-400`) and includes a subscribe/follow CTA. | Visual inspection / Playwright screenshot comparison. |

## Out of Scope
- **Email delivery** — The weekly digest is implemented as in-app notifications only; SMTP/email infrastructure is deferred.
- **Advanced recommendation algorithm** — Discovery ranking uses simple follower count + tag overlap; machine-learning relevance scoring is deferred.
- **Real-time WebSocket** — Shared-edit updates use 3-second polling; full WebSocket implementation is deferred.
- **Payment / team plans** — No billing, quotas, or enterprise roles beyond `editor`.
- **Browser extension & mobile** — No changes to the Manifest-V3 extension or mobile share sheet.
- **Full-text search across public collections** — Searching public content is deferred.

## Dependencies
- Sprint 1–4 codebase exists in `project/` (React frontend, FastAPI backend, SQLite DB, Alembic migrations, auth JWT flow, bookmarks, tags, collections, AI summarization, browser extension, import/export).
- `Collection` model and CRUD endpoints are already implemented in Sprint 3.
- User authentication (`/api/auth/login`, `/api/auth/register`, JWT middleware) is already implemented in Sprint 2.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** FastAPI (Python) + SQLite + Alembic
- **All previous sprint code is in `project/`**
