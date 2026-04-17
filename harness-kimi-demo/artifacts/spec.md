# Lumina — Intelligent Bookmark Library

## Overview

Lumina reimagines the bookmark manager as a living knowledge base. Most people abandon bookmarks because they become an unsearchable pile of URLs. Lumina solves this with an AI-assisted layer that auto-tags, summarizes, and surfaces the right link at the right time. The product begins as a polished, reactive React demo that proves the UX hypothesis—beautiful cards, instant tag filtering, and fluid interactions—before growing into a full-stack ecosystem with sync, browser extensions, and social discovery.

The long-term vision is a "read-later + bookmark + knowledge-graph" hybrid. Users save links via a browser extension or mobile share sheet. Lumina fetches the page content, extracts key topics, generates a short summary, and places the item into smart collections. Over time, the system learns preferences and surfaces forgotten gems. Collaboration features let teams build shared libraries, turning individual bookmarks into collective intelligence.

## Design Language

**Mood:** Calm, focused, scholarly-modern. The interface should feel like a premium digital library rather than a spreadsheet of links.

**Color Palette:**
- **Background:** `slate-950` (#020617) — deep, paper-like dark mode.
- **Surface:** `slate-900` (#0f172a) for cards, `slate-800` (#1e293b) for hover states.
- **Primary Accent:** `indigo-500` (#6366f1) for actions, active filters, and selection rings.
- **Secondary Accent:** `emerald-400` (#34d399) for success states and AI-generated indicators.
- **Text:** `slate-200` (#e2e8f0) primary, `slate-400` (#94a3b8) secondary.

**Typography:**
- **Headings:** Inter, font-weight 600–700, tight letter-spacing.
- **Body:** Inter, font-weight 400, line-height 1.6 for readability.
- **Tags/Mono:** JetBrains Mono for metadata (dates, URLs) at small sizes.

**Layout & Components:**
- **Card Grid:** Responsive masonry or uniform grid (min 320px card width) with generous gap (24px).
- **Tag Chips:** Pill-shaped, glassmorphism subtle border (`border-slate-700`), hover lift effect.
- **Filter Bar:** Sticky top bar with horizontally scrollable tag cloud and a search input.
- **Empty States:** Illustrative, friendly copy with a clear call-to-action.

## Features

### Sprint 1: Interactive Frontend Demo
*Goal: Validate the core UI/UX with a single React + Vite page using mock data. No backend.*

#### Feature 1.1: Bookmark List View
**User Stories:**
- As a user, I want to see my bookmarks displayed as rich cards with title, URL preview, thumbnail, and saved date so that I can quickly scan my library.
- As a user, I want the layout to adapt gracefully from mobile to desktop so that I can use the app on any device.

**Acceptance Criteria:**
- [ ] A Vite + React application renders a responsive grid of bookmark cards.
- [ ] Each card displays title, hostname, favicon/thumbnail placeholder, and relative saved date.
- [ ] The app loads without backend dependencies.

#### Feature 1.2: Tag Chips & Filtering
**User Stories:**
- As a user, I want each bookmark to show associated tag chips so that I understand how items are categorized.
- As a user, I want to click a tag chip to filter the list to only bookmarks with that tag so that I can narrow down results instantly.
- As a user, I want a search input that filters by title or tag name so that I can find bookmarks quickly.

**Acceptance Criteria:**
- [ ] Clicking a tag chip toggles a filter state and updates the visible list in real time.
- [ ] Multiple tags can be selected; the list shows bookmarks matching *any* selected tag (OR logic).
- [ ] A search bar filters the list by substring match against title or tag name.
- [ ] Active filters are visually highlighted and can be cleared with a single action.

#### Feature 1.3: Mock Data Architecture
**User Stories:**
- As a developer, I want a robust mock data layer so that the demo feels realistic and future backend integration is straightforward.

**Acceptance Criteria:**
- [ ] Mock data contains at least 24 diverse bookmarks with 8–12 unique tags.
- [ ] Mock data schema mirrors the planned REST API resource shape (id, title, url, tags[], summary, createdAt, updatedAt).
- [ ] State management is structured so that swapping mock data for API calls requires changes in only one module.

---

### Sprint 2: Core Backend & Sync
*Goal: Persist bookmarks, authenticate users, and enable cross-device access.*

#### Feature 2.1: RESTful API
**User Stories:**
- As a user, I want my bookmark list to load from a server so that data is not trapped in one browser.
- As a user, I want to add, edit, and delete bookmarks via the UI so that I can manage my library.

**Acceptance Criteria:**
- [ ] A REST API exposes CRUD endpoints for bookmarks and tags.
- [ ] The frontend replaces mock data with live API calls while preserving all Sprint 1 UX behaviors.
- [ ] API responses follow a consistent JSON schema with proper HTTP status codes.

#### Feature 2.2: User Authentication
**User Stories:**
- As a user, I want to sign up and log in so that my bookmarks are private to me.
- As a user, I want to stay logged in across sessions so that I don’t have to re-enter credentials daily.

**Acceptance Criteria:**
- [ ] JWT-based authentication flow (login, signup, logout) is implemented.
- [ ] Protected routes require a valid token; unauthenticated users are redirected to a login page.
- [ ] Tokens refresh automatically or have a reasonable expiry with a refresh mechanism.

#### Feature 2.3: Persistent Storage
**User Stories:**
- As a user, I want my data stored reliably so that I never lose a saved link.

**Acceptance Criteria:**
- [ ] Bookmarks and tags are stored in a relational database with normalized tables.
- [ ] Database migrations are version-controlled and reproducible.
- [ ] Basic backup/restore strategy is documented.

---

### Sprint 3: AI-Powered Organization
*Goal: Reduce manual tagging and help users rediscover content through machine-generated metadata.*

#### Feature 3.1: Auto-Tagging
**User Stories:**
- As a user, I want the system to suggest relevant tags when I paste a URL so that I don’t have to invent categories manually.
- As a user, I want to accept, reject, or edit AI-suggested tags so that I remain in control.

**Acceptance Criteria:**
- [ ] When a new bookmark URL is submitted, the backend fetches page content and sends it to an LLM service.
- [ ] The LLM returns 3–7 relevant tags; these are displayed as suggestions in the UI.
- [ ] User actions (accept/reject/edit) are persisted and used to refine future suggestions.

#### Feature 3.2: Smart Collections
**User Stories:**
- As a user, I want dynamic folders (e.g., "Unread Last 7 Days", "Design Inspiration") so that I can browse bookmarks by context without manual sorting.
- As a user, I want to create custom rule-based collections (e.g., "all URLs from github.com tagged with 'ai'") so that my library self-organizes.

**Acceptance Criteria:**
- [ ] The system provides at least three default smart collections based on date, domain, and tag combinations.
- [ ] Users can create custom collections using simple rule builders (AND/OR tag/domain/date filters).
- [ ] Smart collections update automatically as bookmarks are added or edited.

#### Feature 3.3: Content Summarization
**User Stories:**
- As a user, I want a one-sentence summary of each saved article so that I can decide whether to revisit it without opening the link.
- As a user, I want summaries to appear in the card view and a detail drawer so that information is accessible at a glance.

**Acceptance Criteria:**
- [ ] The backend generates a 1–2 sentence summary for text-heavy bookmarks via an LLM.
- [ ] Summaries are cached to avoid repeated API calls.
- [ ] The frontend displays summaries on cards and in a dedicated detail view.

---

### Sprint 4: Capture Ecosystem
*Goal: Make saving bookmarks effortless from anywhere on the web.*

#### Feature 4.1: Browser Extension
**User Stories:**
- As a user, I want a one-click browser extension so that I can save the current page without leaving my workflow.
- As a user, I want the extension to pre-fill the title, URL, and suggested tags so that saving takes less than three seconds.

**Acceptance Criteria:**
- [ ] A browser extension (Manifest V3) is published for Chrome and Firefox.
- [ ] Clicking the extension icon opens a minimal save dialog with title, URL, and AI-suggested tags.
- [ ] The extension communicates with the Lumina backend via authenticated API requests.

#### Feature 4.2: Import & Export
**User Stories:**
- As a user, I want to import my existing browser bookmarks (Netscape HTML format) so that I can migrate to Lumina easily.
- As a user, I want to export my library to a standard format so that I retain data portability.

**Acceptance Criteria:**
- [ ] Users can upload a Netscape HTML bookmark file; the system parses folders into tags or collections.
- [ ] Users can export all bookmarks to JSON and Netscape HTML formats.
- [ ] Large imports are processed asynchronously with progress indication.

---

### Sprint 5: Collaboration & Discovery
*Goal: Turn personal libraries into shared knowledge networks.*

#### Feature 5.1: Shared Collections
**User Stories:**
- As a user, I want to share a specific collection via a public or team-private link so that colleagues can benefit from my curated links.
- As a user, I want to invite collaborators to co-manage a collection so that we can build team resources together.

**Acceptance Criteria:**
- [ ] Any collection can be toggled between private, public read-only, and shared-edit modes.
- [ ] Public collections have a clean, branded landing page with a subscribe/follow option.
- [ ] Shared-edit collections support real-time or near-real-time updates for all collaborators.

#### Feature 5.2: Feed Discovery
**User Stories:**
- As a user, I want to discover trending or related public collections so that I can expand my knowledge.
- As a user, I want to follow creators and receive a digest of their new bookmarks so that I stay updated.

**Acceptance Criteria:**
- [ ] A discovery feed surfaces public collections based on popularity and relevance to the user’s tags.
- [ ] Users can follow other users or specific collections.
- [ ] A weekly digest email (or in-app notification) summarizes new bookmarks from followed sources.

## Technical Architecture

**Stack:**
- **Frontend:** React 18+, Vite, Tailwind CSS, React Query (TanStack Query), React Router.
- **Backend:** Node.js with Express (or Python with FastAPI) — choice deferred to implementation team.
- **Database:** PostgreSQL for relational data; Redis for caching summaries and session state.
- **AI Layer:** OpenAI GPT-4o / Anthropic Claude API for tagging, summarization, and smart-collection rule suggestions.
- **Infrastructure:** Vercel or Netlify for frontend hosting; Railway, Render, or AWS ECS for backend; Cloudflare R2 or AWS S3 for thumbnail storage.

**Data Model (High-Level):**
- `User` — id, email, password_hash, created_at.
- `Bookmark` — id, user_id, url, title, summary, thumbnail_url, created_at, updated_at.
- `Tag` — id, name, user_id (or global scope), color.
- `BookmarkTag` — join table linking bookmarks and tags.
- `Collection` — id, user_id, name, rules_json, visibility_enum.
- `CollectionBookmark` — join table for explicit collection membership.

**API Surface:**
- `GET    /api/bookmarks` — list with pagination, search, and tag filters.
- `POST   /api/bookmarks` — create; triggers async AI enrichment.
- `GET    /api/bookmarks/:id`
- `PATCH  /api/bookmarks/:id`
- `DELETE /api/bookmarks/:id`
- `GET    /api/tags`
- `POST   /api/collections`
- `GET    /api/collections/:id/bookmarks`
- `POST   /api/auth/login` & `/api/auth/register`

**AI Integration Flow:**
1. User submits a URL.
2. Backend fetches raw HTML (respecting robots.txt).
3. Content is sanitized and truncated.
4. LLM prompt requests tags and a 1–2 sentence summary.
5. Results are cached in Redis and persisted to PostgreSQL.
6. Frontend polls or receives a WebSocket update when enrichment completes.

**Security & Privacy:**
- All API traffic over HTTPS.
- Row-level security ensures users access only their own data (or explicitly shared collections).
- AI prompts must not include sensitive user metadata beyond the public page content.
