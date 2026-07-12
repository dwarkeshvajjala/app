# 03 - System Architecture

## 3.1 Layered Architecture

```
Agency Dashboard (React + React Query + Zustand)
        |
Review SDK  (injected into reviewed site / proxy layer)
        |
Anchor Engine   (fingerprint + recover elements)
        |
Snapshot Engine (normalized DOM snapshot per page load)
        |
Revision Engine (page history + diffing)
        |
Recovery Engine (orchestrates anchor recovery on diff)
        |
Realtime Layer   (WebSocket gateway + Redis pub/sub)
        |
API Layer        (FastAPI: routers -> services -> repos)
        |
MongoDB (system of record)  +  Cloudflare R2 (blobs)
        |
Notifications (email, Slack)  +  Integrations (ClickUp...)
```

Each layer only calls the layer directly below it. The Anchor Engine never talks to MongoDB directly - it returns a result to the Recovery Engine, which persists it through the API layer's repository. This is what Rule 5 (Modular by Default, `02-Engineering-Principles.md`) buys you: you can rewrite the Anchor Engine's matching algorithm without touching persistence.

## 3.2 Where Each Layer Runs

| Layer | Runtime | Notes |
|---|---|---|
| Agency Dashboard | Browser (Vercel-hosted static + edge) | Talks to API Layer over HTTPS + WSS |
| Review SDK | Injected into the *reviewed* site's browser context | Either via a `<script>` snippet (staging sites) or Backline's proxy (link-only mode, no site changes) |
| Anchor / Snapshot Engine (capture side) | Runs client-side, inside the Review SDK | Produces a snapshot/fingerprint payload, uploads it |
| Recovery Engine (matching side) | Backend (Python), triggered on new revision | Compares snapshots, updates anchor state |
| Revision Engine | Backend | Owns the page -> revision -> snapshot chain |
| Realtime Layer | Backend (FastAPI WebSocket routes + Redis) | Redis pub/sub so multiple API instances fan out events |
| API Layer | Backend (FastAPI, Railway) | Stateless, horizontally scalable |
| MongoDB | MongoDB Atlas | System of record |
| Cloudflare R2 | Cloudflare | Screenshots, snapshot blobs |

## 3.3 Two Ways a Client Sees the Reviewed Site

1. **Snippet mode** (staging sites the agency controls): one `<script src="https://cdn.backline.app/sdk.js" data-project="...">` tag. SDK runs in the actual page context - most accurate DOM access, no proxy latency.
2. **Proxy/link mode** (install-free path, F1 in the vision doc): Backline reverse-proxies the target site, injecting the SDK server-side into the HTML response before it reaches the client's browser. Slightly higher latency, but true zero-friction - this is the default path for F7 onboarding ("install-free path first").

Both modes produce the same anchor/snapshot payload shape (`09-Snapshot-Engine.md`) - the Recovery Engine doesn't know or care which mode captured it.

## 3.4 Request Lifecycle: Posting a Comment (End to End)

1. Client taps the page in the Review SDK - pin-drop UI opens.
2. SDK computes the element's anchor (DOM fingerprint + text fingerprint; see `08-Anchor-Engine.md`) and captures a screenshot of the current viewport.
3. SDK uploads the screenshot to `POST /api/v1/uploads` - gets back an R2 object key (pre-signed PUT, `18-Storage-Deployment.md`).
4. SDK submits `POST /api/v1/pages/{page_id}/comments` with: body text, anchor payload, screenshot key, browser/OS/viewport metadata, layer (defaults to `client` for guest authors).
5. API layer: validates the guest session, resolves `page_id` (creating the page record if this is a first-seen URL under the project), persists the comment, appends an `events` audit record.
6. API layer publishes `comment.created` to Redis; the Realtime Layer fans it out over WebSocket to every connected dashboard session in that workspace.
7. If a Slack integration is configured, the event is enqueued to the notifications worker (`17-Notifications-Integrations.md`) - this is async, off the request path, so comment creation is never slowed down by a flaky Slack webhook.
8. Dashboard receives the WS event, React Query cache is updated via targeted invalidation (`14-State-Management.md`), kanban board updates without a refetch.

Principle P5 (Graceful Failure) applies at every step above: if screenshot upload fails, the comment still posts with `screenshot_key: null` and a `capture_status: "failed"` flag - never block the comment on the screenshot.

## 3.5 Multi-Tenancy Model

- **Isolation boundary is the workspace.** Every collection that isn't global (users, workspaces themselves) carries a `workspace_id`, and every repository method that reads or writes one of those collections requires a `workspace_id` filter - there is no code path that queries `comments` without it. This is enforced with a repository-layer helper (`06-Backend-Architecture.md` §6.4), not left to route handlers to remember.
- **Guests are never rows in `users`.** A client reviewer is a `guest_session`, scoped to one `share_link`. They never get workspace membership, never get a password, never appear in billing seat counts.
- **Cross-tenant guarantee:** a JWT for workspace A's member can never be presented as authorization for workspace B's resources, even for the same human (someone who's a member of two agencies has two independent memberships, and the token is workspace-scoped, not user-scoped, after login - see `13-Authentication.md`).

## 3.6 Extension Points (For Features Explicitly Excluded from MVP)

Built as interfaces now, implemented later - so v-next doesn't require re-architecting:

- **Integrations**: a generic `Integration` interface (`17-Notifications-Integrations.md`) so Jira/GitHub/GitLab can be added as new implementations, not new subsystems.
- **AI features** (duplicate detection, summarization, prioritization): the `events` collection is append-only and complete enough to be replayed/batch-processed by a future AI service without changing the write path today (Rule 4, Deterministic Before Intelligent - AI is additive, never load-bearing, in MVP).
- **Public API**: the internal REST API is already versioned (`/api/v1/...`) and permission-scoped per workspace, which is most of what a public API needs; v-next work is API keys + rate-limit tiers, not a redesign.
- **Billing**: `workspaces.plan` field exists from day one (`11-Database.md`) even though no plan enforces limits pre-MVP, so billing integration doesn't require a schema migration to retrofit.
