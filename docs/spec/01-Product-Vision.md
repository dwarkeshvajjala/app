# 01 - Product Vision

## 1.1 Problem Statement

Web agencies need clients to review staging and live websites and give actionable feedback. Existing tools (Marker.io, Pastel, Ruttl, Userback, BugHerd, Atarim, Feedbucket, and a long tail of indie tools) technically solve this - but adoption fails on the client side. Clients refuse to install extensions, forget logins, can't comment from mobile, and drift back to email and WhatsApp within weeks. This is consistent across G2 review "cons" sections, dozens of Reddit threads, and direct observation of agencies doing manual Figma-screenshot workarounds.

When feedback moves back to email, the agency pays the cost: screenshot archaeology, ambiguous references ("the button"), duplicated feedback across channels, missed items, and client frustration during the highest-stakes phase of a project - pre-launch review.

**The product's single job:** make it so easy for a non-technical client to leave contextual feedback that falling back to email never happens.

## 1.2 What This Product Is NOT Solving (Non-Goal Clarification)

The original project thesis was that comments break/orphan when page sections move ("comment drift"). Research killed this as a *positioning* wedge - it appears zero times in G2 review summaries for five competitor tools and zero times across 15+ Reddit threads. Nobody is choosing a tool because it solves comment drift; they don't know to ask for it.

**Implication for engineering:** the Anchor/Recovery Engine (`08-Anchor-Engine.md`, `10-Revision-Recovery.md`) is a **v-next quality bar**, not a v1 marketing feature. It must exist because a tool that silently loses comments on every deploy is unshippable - but it must never be allowed to drive MVP scope, timeline, or architecture gold-plating. If a milestone is slipping because the Anchor Engine is being over-engineered, cut it back to DOM-fingerprint-only and ship.

## 1.3 Product Mission

Backline is a collaborative website review platform for agencies, product teams, designers, developers, QA teams, and their clients. It lets anyone review a website, place contextual comments directly on UI elements, discuss issues, and manage review workflows - without browser extensions, technical knowledge, or client accounts.

Working name: **Backline**. The name can change without affecting architecture - nothing below is name-coupled.

## 1.4 Product Philosophy

Existing tools think in pixels: a comment belongs to the x/y coordinate where a click happened. Backline thinks in interfaces: a comment belongs to the *element*, and the platform's job is to keep that association true as the site evolves.

- Every deployment creates a new **revision**.
- Every revision is diffed against the one before it.
- Every comment remembers what it was attached to and follows that element through change, when recovery is possible.
- When recovery isn't possible, the platform says so - it never silently drops context.

## 1.5 Target Users

| User | Role | Core need |
|---|---|---|
| Agency PM / Account Manager | Workspace Admin | Triage feedback fast, keep clients out of internal chatter |
| Agency Developer | Member | Unambiguous repro: exact element, browser, viewport, screenshot |
| Client Reviewer | Guest (no account) | Comment on their site in under 30 seconds from a link tap |
| Freelance Designer | Admin (solo workspace) | Same tool, smaller team, price-sensitive |

## 1.6 Jobs To Be Done

- "When I'm reviewing a staging site on my phone, I want to tap the thing that's wrong and say why, without creating an account."
- "When a client leaves feedback, I want to route it to my team without the client seeing our internal disagreement about it."
- "When I triage 50 comments before a launch, I want one board, not five inboxes."
- "When a comment references something on a page that's since changed, I want to know whether it's still valid - not just have it vanish."

## 1.7 Competitive Landscape

| Competitor | URL | Notable gap Backline targets |
|---|---|---|
| Marker.io | marker.io | Integrations are the moat; commenting UX is table stakes |
| Pastel | usepastel.com | No persistent anchor story; coordinate-based |
| Markup.io | markup.io | Limited team/client visibility separation |
| Atarim | atarim.io | WordPress-centric |
| Ruttl | ruttl.com | Coordinate-based; weak mobile reviewer flow |
| BugHerd | bugherd.com | **Gates private team-comments behind $125/mo** - Backline includes on every tier |
| Feedbucket | feedbucket.app | Narrow integration set |

**Evidence-backed differentiators for MVP** (not the anchor engine - that's v-next):
1. Zero-friction link-based review (no accounts, no extensions).
2. Private vs. client-visible comment layers, on **every** plan, enforced server-side.
3. One deep PM integration at launch (ClickUp), because Reddit evidence consistently says missing integrations make a tool "useless for agencies."

## 1.8 Product Principles

| # | Principle | Meaning |
|---|---|---|
| P1 | Zero Friction | Reviewers install nothing; everything works from a URL |
| P2 | Persistent Context | Comments survive deployments whenever technically possible |
| P3 | Progressive Recovery | Always attempt recovery before declaring a comment lost |
| P4 | Human First | Never hide uncertainty; low-confidence recovery is disclosed |
| P5 | Graceful Failure | Every failure explains itself (screenshot failed, element removed, etc.) |
| P6 | Version Awareness | Every review belongs to a page revision |
| P7 | Multi-Tenant by Design | Workspace isolation is mandatory in every architectural decision |
| P8 | Incremental Delivery | Every feature independently deployable; no milestone N+1 before N is production-ready |

## 1.9 Scope

### Included in MVP
Workspaces, Projects, Share links, Guest reviewers, Review SDK, Contextual comments, Anchor Engine (DOM-fingerprint tier only), Snapshot Engine, Revision Engine, Recovery Engine (basic), Kanban dashboard, List dashboard, Team vs. client comment layers, Screenshot capture, Cloudflare R2 storage, Slack integration, ClickUp integration, Trello integration, Email notifications, Google login, Email OTP, WebSockets (realtime comments/presence), Responsive reviewer UI.

### Explicitly excluded from MVP
AI comment summaries/duplicate detection/prioritization, Jira/GitHub/GitLab integrations, Custom branding / white-labeling, Billing, Public API, Browser extension, Desktop app, Native mobile apps, Video recording, Session replay, Visual regression testing.

These are architected for (interfaces left open) but never implemented pre-MVP. See `03-System-Architecture.md` §3.6 for extension points.

## 1.10 Success Metrics

| Metric | Target |
|---|---|
| Time from link-tap to first posted comment (new client, iPhone Safari) | < 30 seconds |
| Screenshot capture success rate (top 20 browser/OS combos) | >= 90% |
| PM triage throughput | 50 comments across 3 pages in < 10 minutes |
| New agency onboarding: signup -> first client link sent | < 10 minutes, unaided |
| Comment -> ClickUp round trip | Preserves screenshot, metadata, deep link, 100% of attempts |
| Client-visible/team-only leak rate | 0 (server-enforced, tested every release) |
