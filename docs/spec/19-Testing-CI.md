# 19 - Testing & CI/CD

## 19.1 Test Pyramid

| Layer | Tool | Scope |
|---|---|---|
| Unit - backend | pytest | Service-layer logic, permission matrix, anchor confidence scoring, diff engine |
| Unit - frontend | Vitest + React Testing Library | Components (tier 1 `packages/ui` especially - these are shared, bugs here propagate everywhere), hooks |
| Integration - backend | pytest + ephemeral Mongo instance | Repository layer against a real Mongo instance (not mocked - workspace-scoping bugs are exactly the kind that mocks hide) |
| Integration - full stack | Playwright | Critical user journeys end to end against a running backend + frontend |
| Golden dataset - Anchor/Recovery Engine | pytest, fixture-based | See §19.2 |
| Performance | Playwright + Lighthouse CI | SDK bundle size budget, time-to-interactive, dashboard load time |

## 19.2 Golden Dataset Tests for the Recovery Engine

Because "does recovery still work" isn't a normal assertion - it's a statistical claim (`08-Anchor-Engine.md`'s confidence thresholds) - maintain a fixture set of paired snapshots representing known transformation types:
- Identical page (sanity: everything should be `ok`, confidence `1.0`).
- Element moved (reordered sibling) - expect stable-attribute or DOM-path match.
- Element text edited - expect text-fingerprint match, not exact.
- Element removed entirely - expect `orphaned` after full traversal.
- Ambiguous duplicate elements (e.g., two "Learn more" buttons) - expect `low_confidence`, not a silent wrong match.

Each fixture pair has an expected `recovery_status` + confidence range; CI fails if a change to the diff/anchor logic regresses any fixture's expected outcome. This is the automated version of Rule 4 (Deterministic Before Intelligent) - deterministic behavior should be exactly reproducible in tests, not "usually works."

## 19.3 Critical Playwright Journeys

1. Agency signs up (Google OAuth) -> creates workspace -> creates project -> generates share link.
2. Guest opens share link on a mobile viewport -> posts a comment in under the SDK's performance budget -> agency dashboard receives it via WebSocket without a manual refresh.
3. Team member posts a team-only reply -> guest re-opens the same thread -> team-only reply is absent from the guest's view (this is the test that actually proves F3's security requirement, not just a UI check - assert against the raw API response the guest session receives, not just what's rendered).
4. Comment's page is redeployed with a structural change -> recovery pipeline runs -> comment's `recovery_status` updates and is reflected in the dashboard.
5. Comment -> ClickUp task creation round-trip preserves screenshot/metadata/backlink.

## 19.4 CI/CD Pipeline (GitHub Actions)

```
on: pull_request, push to main
jobs:
  lint:        ruff + eslint + prettier --check
  typecheck:   mypy --strict app/  &&  tsc --noEmit
  test-unit:   pytest -m "not integration"  &&  vitest run
  test-integration: start mongo+redis (service containers or native binaries)  &&  pytest -m integration
  test-e2e:    playwright test (against a preview deploy, PR-only)
  build:       turbo build (frontend + widget bundles)
  deploy:      (main only) trigger Vercel + Railway deploys, then smoke test
```
Branch protection on `main`: all jobs above must pass; at least one approving review required (Rule 2, Production Quality Only, enforced structurally, not just by policy).

## 19.5 Performance Test Gates

- SDK bundle size check fails the build if gzipped size exceeds 40KB (`07-Review-SDK.md` §7.7) - enforced via a `size-limit` CI step, not manual spot-checking.
- Lighthouse CI on the dashboard's board view, budget: Time to Interactive < 2.5s on a throttled connection profile.

## 19.6 Test Data Hygiene

Integration/E2E tests run against ephemeral, seeded databases per run (service containers or native binaries in CI, a fresh Atlas preview cluster namespace per PR) - never against staging or production data. Seed fixtures live in `backend/tests/fixtures/` and mirror realistic shapes (using the schemas in `11-Database.md`), not minimal/degenerate stand-ins, since anchor/recovery correctness depends on realistic DOM shapes.
