# 02 - Engineering Principles

## 2.1 The Engineering Constitution

These rules are mandatory for every line of code in this repository. A pull request that violates one of these without a linked Technical Decision Record (§2.4) should not merge.

### Rule 1 - Architecture Before Code
Before implementing any feature, the module's dependencies, data flow, and acceptance criteria must be documented (in this spec, or a TDR amending it). No code is written until that's true.

### Rule 2 - Production Quality Only
No placeholder implementations, `TODO` blocks, mock logic, or "temporary" shortcuts in anything merged to `main`. Every milestone that's marked done in `20-Build-Plan.md` must be deployable, not scaffolded.

### Rule 3 - Single Source of Truth
Models, API contracts, enums, and validation rules live in one canonical location and are shared, not re-declared. Concretely: Pydantic schemas in the backend are the source of truth for API shapes; the frontend generates its TypeScript types from the OpenAPI schema (`openapi-typescript`), it never hand-maintains parallel interfaces.

### Rule 4 - Deterministic Before Intelligent
Wherever a deterministic solution exists, prefer it over heuristic or AI-based behavior. The Anchor Recovery Engine exhausts DOM-fingerprint and text-fingerprint matching before ever considering fuzzier visual-similarity matching (`08-Anchor-Engine.md`).

### Rule 5 - Modular by Default
Every major capability (Review SDK, Anchor Engine, Snapshot Engine, Revision Engine, Recovery Engine, Notifications, Integrations) is an independent module behind a clear interface, so it can change without touching unrelated parts of the system. Concretely: each is its own Python package under `backend/app/modules/*` with no reverse imports from `core` into a module.

### Rule 6 - Security Is a Feature
Workspace isolation, permission checks, signed URLs, rate limiting, input validation, and audit logging are first-class, present-from-milestone-one requirements - never "add later."

## 2.2 Coding Standards

**Python (backend)**
- Python 3.12, `ruff` for lint + format (replaces black/isort/flake8), `mypy --strict` on `app/` (not on generated/vendor code).
- Pydantic v2 models for every request/response body and every internal service boundary - no raw `dict` crossing a function signature that represents a domain object.
- Async all the way: `async def` route handlers, Motor (async MongoDB driver), `httpx.AsyncClient` for outbound calls.
- Errors are typed exceptions (`app.core.errors`), caught once in middleware, never `except Exception: pass`.

**TypeScript (frontend)**
- Strict mode on. No `any` without a `// TODO(TDR-xxx):` linked to a Technical Decision Record explaining why.
- Functional components only; no class components.
- ESLint + Prettier, enforced in CI, not just pre-commit (pre-commit can be skipped; CI can't).

**Naming**
- MongoDB collections: plural snake_case (`share_links`, `guest_sessions`).
- REST paths: plural nouns, kebab-case where multi-word (`/share-links`).
- WebSocket event types: `resource.action` (`comment.created`, `presence.updated`).

## 2.3 Git Workflow

- Trunk-based development. `main` is always deployable.
- Feature branches: `feat/<milestone>-<short-desc>`, e.g. `feat/m3-review-sdk-init`.
- One PR per milestone sub-task; PR description links the relevant spec section(s).
- No direct pushes to `main`; CI (lint, typecheck, unit, integration) must pass before merge.
- Squash-merge, conventional commit messages (`feat:`, `fix:`, `chore:`, `docs:`) - this drives changelog generation.

## 2.4 Technical Decision Records (TDRs)

Any deviation from this spec, or any decision not covered by it, gets a TDR: `/docs/tdr/NNNN-short-title.md`, format:

```markdown
# TDR-0001: <Title>
Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by TDR-00xx

## Context
What forced this decision.

## Decision
What we're doing.

## Consequences
What this changes elsewhere in the spec (link the file/section).
```

This spec is the source of truth; TDRs are dated amendments to it, not replacements for reading it.

## 2.5 Monorepo Structure

```
backline/
  apps/
    web/            # Agency dashboard (React)
    widget/         # Reviewer-facing Review SDK bundle
  backend/
    app/            # FastAPI application (see 06-Backend-Architecture.md)
  packages/
    ui/             # Shared design-system components (05, 15)
    types/          # Generated TS types from OpenAPI (Rule 3)
  docs/
    spec/           # This specification
    tdr/            # Technical Decision Records
  infra/            # IaC / deployment config (18-Storage-Deployment.md)
```
Package manager: `pnpm` workspaces + Turborepo for task orchestration (build/lint/test caching across `apps/*` and `packages/*`).

## 2.6 Accessibility & Browser Support

- WCAG 2.1 AA is the bar for the agency dashboard and the reviewer widget alike - the widget is used by non-technical clients, it cannot assume technical fluency *or* full vision/motor ability.
- Reviewer widget supported matrix: last 2 versions of Safari (iOS + macOS), Chrome (Android + desktop), Firefox, Edge. Mobile Safari is the priority browser - it's where most client review happens.
- Dashboard supported matrix: evergreen desktop browsers only; no IE, no legacy Edge.
