# Backline - Master Engineering Specification (v1.0)

**Backline** is a collaborative website review platform: clients open a link, click anywhere on a live or staging site, and leave a contextual comment - no account, no extension, no install. Agencies get a dashboard, a kanban/list workflow, and integrations (Slack, ClickUp, Trello, Asana) so feedback never falls back to email.

The differentiator: comments attach to a **Persistent Anchor** (structural + text + visual fingerprint of the element), not to x/y screen coordinates. When the page changes, the **Recovery Engine** tries to re-locate the element the comment belongs to, and tells the user honestly when it can't.

This folder is the single source of truth for building it end to end.

## How to use this spec

1. **Read in order.** Each file assumes the previous ones are known. Don't jump to `06-Backend-Architecture.md` without `04-Technology-Decisions.md` and `11-Database.md` - the schemas are defined once, there.
2. **Nothing is implemented out of order.** Follow `20-Build-Plan.md` milestone by milestone. Do not start milestone N+1 until milestone N meets its Definition of Done (`20-Build-Plan.md`, final section).
3. **No placeholders.** Every milestone that's marked "done" must be a working, deployable slice - see Engineering Constitution, `02-Engineering-Principles.md`.
4. **This is the canonical source.** If code and spec disagree, either the code is wrong or the spec needs a dated amendment (see TDR process in `02-Engineering-Principles.md`). Don't silently drift.

## File index

| # | File | Contents |
|---|---|---|
| 00 | `00-README.md` | This file |
| 01 | `01-Product-Vision.md` | Problem, thesis, users, competitive landscape, scope, non-goals, success metrics |
| 02 | `02-Engineering-Principles.md` | Engineering Constitution, coding standards, git workflow, TDR process |
| 03 | `03-System-Architecture.md` | Layered architecture, request lifecycle, multi-tenancy model |
| 04 | `04-Technology-Decisions.md` | Full stack choices + rationale |
| 05 | `05-Frontend-Architecture.md` | React app structure, routing, feature modules, permissions |
| 06 | `06-Backend-Architecture.md` | FastAPI structure, layering, background jobs, event sourcing |
| 07 | `07-Review-SDK.md` | The embeddable/proxy widget: init, capture, upload, reconnect, offline |
| 08 | `08-Anchor-Engine.md` | Fingerprinting + recovery strategies + confidence scoring |
| 09 | `09-Snapshot-Engine.md` | Normalized DOM snapshot format, hashing, diffing |
| 10 | `10-Revision-Recovery.md` | Revision lifecycle, diff engine, recovery pipeline orchestration |
| 11 | `11-Database.md` | Every MongoDB collection, indexes, TTLs, key aggregations |
| 12 | `12-API-WebSocket.md` | Every REST endpoint + every WebSocket event |
| 13 | `13-Authentication.md` | Google OAuth, email OTP, JWT, guest sessions, permission matrix |
| 14 | `14-State-Management.md` | React Query cache strategy, Zustand scope rules |
| 15 | `15-Design-System.md` | Tokens, components, dark mode, accessibility |
| 16 | `16-Dashboard.md` | Every agency screen + the reviewer widget UX |
| 17 | `17-Notifications-Integrations.md` | Slack, ClickUp, Trello, Asana, email digests, webhook retries |
| 18 | `18-Storage-Deployment.md` | R2 layout, signed URLs, environments, infra, feature flags |
| 19 | `19-Testing-CI.md` | Test pyramid, golden datasets for recovery, CI/CD pipeline |
| 20 | `20-Build-Plan.md` | Milestone-by-milestone build order + Definition of Done |

## Local development deviation (TDR-0001)

The original spec assumes Docker Compose for local Mongo/Redis/MinIO and Homebrew for toolchain provisioning. The actual dev machine had no Homebrew and no passwordless sudo, so local dev instead uses: `nvm` (Node 20), `corepack` (pnpm), `uv` (Python 3.12), and native `mongod`/`redis-server`/`minio` binaries run directly (no containers). See `docs/tdr/0001-local-toolchain-without-docker.md`. This changes nothing about the architecture, schemas, or production deployment target (Railway/Vercel/Atlas/R2 remain as specified in `18-Storage-Deployment.md`) - it only changes how a laptop without Docker/Homebrew runs the same services locally.
