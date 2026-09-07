# HTML Parity Audit Review – Senior Code Review Summary

Date: 2026-09-07
Source audit: docs/implementation/07-html-parity-audit.md
Scope: Review of implemented parity items, coding standards, architecture, frontend state, backend routing/auth/DB, and broader repository health. No code changes made.

## Review Methodology

- Read the full audit file and extracted FD-AUD and UX-AUD items.
- Inspected repo structure, largest files, backend router/service/repository boundaries, indexes, auth flow, React Query usage, component sizes.
- Cross-checked claims against docs/spec and implementation files.
- Rating: ✅ Good / ⚠️ Partial / ❌ Gap / 🔁 Intentional divergence

## Overall Assessment

The product has a solid foundational implementation with workspace-scoped APIs, React Query data layer, FastAPI router/service/repository boundaries, and proper tenant isolation. The core user journeys for projects, tickets, comments, assets, share links and guest review are present and server-enforced.

Critical gaps remain in parity with the supplied HTML prototype: project settings persistence, page management, deploy/version history, global search completeness, share-link policies, notification routing, comment move/resize, ticket drag/drop, account security/preferences, and the full micro-UX/accessibility matrix. Frontend architecture is consistent but several screens mix UI and data concerns and the shell has two overlapping patterns. Backend is well structured but some schemas are missing fields and indexes exist only at startup.

## Frontend Architecture & State Management

### What was done
- React Query used app-wide for server state. Query keys centralized in libs/query-keys.ts.
- URL parameters drive filters; no business data in localStorage.
- Separate TypeScript widget in apps/widget.
- Components generally < 350 LOC; largest TicketsPage.tsx ~328 lines.

### What was done wrong / gaps
- Shell duality: DashboardSidebar.tsx and WorkspaceSidebar.tsx coexist with different token/CSS vocabularies. UX-AUD-001.
- Several page components own multiple responsibilities: data fetching, UI layout, mutation handling together. E.g., CommentsTab.tsx and BoardPage.tsx contain query logic + rendering + mutation callbacks.
- No shared toast/notification service; success/error feedback is component-local. UX-AUD-008.
- Global keyboard shortcuts, popover focus trap, outside-click contracts are ad-hoc. UX-AUD-016, UX-AUD-017, UX-AUD-028.
- Missing route focus restoration, skeletons, and layout stability. UX-AUD-014, UX-AUD-078.

### Better approach
- Choose one shell + design token source. Decommission or clearly mark WorkspaceSidebar as legacy.
- Extract data hooks per feature: useProjects, useTickets, useComments returning {data,mutate,...}. Keep components presentational.
- Introduce a single UI primitive layer for Dialog, Popover, Toast, Menu with ARIA contracts and focus management.
- Add route-level skeletons and `useDocumentTitle` consistently. Centralize error handling via React Query error boundaries.

### Files to inspect
apps/web/src/app/layout/DashboardSidebar.tsx, WorkspaceSidebar.tsx
apps/web/src/features/projects/panel/CommentsTab.tsx
apps/web/src/features/board/BoardPage.tsx
apps/web/src/lib/query-keys.ts

Search repo: grep for `useQuery` duplication in same component; find components >400 LOC.

## Backend Routing, Services, Auth

### What was done
- FastAPI routers per module with clear prefix/tags.
- Service/repository separation in backend/app/modules/*.
- OTP-only authentication implemented per decision, with Google OAuth, refresh token rotation and family revocation.
- Workspace scoping enforced via dependencies and repository queries. Workspace-scoping lint exists.
- Pydantic schemas and generated types used.

### What was done wrong / gaps
- FD-AUD-007/008: password model intentionally replaced with OTP-only. Decision documented, but UX expectations for caps-lock, password strength, reset flows remain missing.
- FD-AUD-011: profile, preferences, sessions, 2FA not implemented. Auth router has /sessions list/revoke and /me patch, but UI and preference persistence missing.
- Project settings schema incomplete: ProjectSettingsOut only exposes proxy_mode and snippet_installed. FD-AUD-018, FD-AUD-045.
- Project-scoped ACLs not implemented: share modal creates workspace-wide membership. FD-AUD-039.
- Share-link policy UI incomplete: API has expiresAt but UI does not expose Never/7/30 selector, domain restriction, regenerate lineage. FD-AUD-040, FD-AUD-066.
- Auth tokens stored in httpOnly cookie with SameSite=None; secure flag toggles by environment – verify production TLS.

### Better approach
- Keep router thin; move authorization checks to core.permissions / actor_access.
- Extend project schema and migration plan per FD-AUD-045. Add settings flags and enforce in widget/guest flows server-side.
- Implement project-scoped roles or explicitly document divergence in PRD.
- Centralize permission matrix tests; run workspace-scoping lint in CI.
- Add session invalidation UI and preference persistence.

### Files to inspect
backend/app/modules/auth/router.py
backend/app/modules/auth/service.py
backend/app/modules/projects/schemas.py
backend/app/modules/projects/service.py
backend/app/core/permissions.py
backend/app/core/indexes.py

## Database, Indexes, Schema

### What was done
- MongoDB collections workspace-scoped except users/workspaces.
- Indexes created on startup via backend/app/core/indexes.py matching 11-Database.md.
- TTL indexes for refresh_tokens, otp_codes, guest_sessions.
- Append-only events collection for audit.
- Comments indexes support layer filter and workspace isolation.

### What was done wrong / gaps
- FD-AUD-045/046/047: missing schema fields for project settings, user security prefs, share-link policies, pages, deploys, versions, recovery history.
- Search strategy is bounded escaped-regex. Works for now, but no text search provider and ranking/pagination limits noted in FD-AUD-005.
- Some collections lack explicit indexes in spec: notifications created ad-hoc.
- Asset delete/cleanup and audit coverage for security-sensitive mutations need confirmation. FD-AUD-051.

### Better approach
- Add additive migrations for new fields with backfill scripts. Keep legacy reads compatible.
- Create a migration checklist per TDR; run dry-run first.
- Plan provider-backed search with workspace-first indexes.
- Ensure every security-sensitive mutation writes to events with workspace_id.

### Files to inspect
docs/spec/11-Database.md
backend/app/core/indexes.py
backend/app/modules/projects/schemas.py
backend/app/modules/comments/service.py

## Parity & Feature Gaps – Key Items

### Shell & Navigation
- FD-AUD-002 Desktop gate: responsive dashboard kept, intentional divergence. Document decision.
- FD-AUD-003 Workspace switcher popover missing from rail. Current flow via WorkspacePickerPage.
- FD-AUD-004 Account button does not open profile/notifications/security.

### Authentication & Account
- FD-AUD-007/008 Intentional divergence to OTP-only. Acceptable if PRD updated.
- FD-AUD-010 Profile/preferences missing.
- FD-AUD-011 Password change, sessions, 2FA missing.

### Project Lifecycle
- FD-AUD-018 Project review settings not persisted.
- FD-AUD-020 Page management missing from dashboard.
- FD-AUD-021 Deploy history/versions static.
- FD-AUD-022 Duplicate/delete/export not implemented.
- FD-AUD-017 SVG support missing.

### Review Canvas
- FD-AUD-023/024 Preview loading/controls partial.
- FD-AUD-030 Move/resize comments not implemented.
- FD-AUD-029 Composer attachments/mentions partial.

### Tickets & Board
- FD-AUD-034 Drag/drop pending.
- FD-AUD-033 Filters/sorting incomplete.

### Sharing & Guest
- FD-AUD-039 Project access roles not implemented.
- FD-AUD-042 Guest permissions not server-enforced for board visibility/client resolve.

### AI/Billing
- FD-AUD-043/044 intentionally divergent; prototype credits must stay out of production.

## Coding Standards & Repository Health

Rating: ⚠️ Partial

- Lint/typecheck present: Ruff + mypy strict for backend; pnpm lint/typecheck/build for frontend.
- Generated types from OpenAPI used; do not hand-edit.
- No localStorage business data found; locale use acceptable.
- Component sizes reasonable but some features mix concerns.
- Tests exist per module; workspace-scoping lint in CI.
- Missing: shared UI primitives, consistent error/loading states, accessibility audit, localization foundation.

Recommendations:
- Enforce max component size and extract hooks.
- Add visual regression checks for shell consistency.
- Run axe-core accessibility pass on all routes; add reduced-motion support.
- Start i18n extraction before adding locales.
- Document architecture decisions in dated TDR per AGENTS.md.

## Search Scope for Similar Issues

Run these checks repo-wide:
- Frontend state leakage: grep "localStorage.setItem" in apps/web/src
- Large components: find *.tsx with >400 lines
- Mixed responsibilities: grep "useQuery" and "useMutation" in same file with >200 lines
- Missing workspace scope: run backend workspace-scoping lint
- Duplicate shells: grep DashboardSidebar vs WorkspaceSidebar usage
- Missing indexes: compare docs/spec/11-Database.md vs backend/app/core/indexes.py
- Unused CSS vars: audit backline.css vs Tailwind usage

## Priority Order Suggested

1. P0 Production correctness: authentication model final, project settings enforcement, share/guest permissions server-side, workspace isolation.
2. P1 Core journeys: search completion, project lifecycle, page/version flow, comment attachments/mentions, ticket drag/keyboard flow.
3. P1 Accessibility/resilience: dialogs/popovers, focus, live regions, error/retries, offline state.
4. P1 Localization foundation: extract messages, locale preference, shared formatters.
5. P2 Polish: icons, typography density, motion, visual parity.

## Conclusion

Implementation is directionally correct and follows the prescribed architecture. The audit backlog accurately captures the remaining gaps. The biggest risks are missing server-enforced project settings and share policies, incomplete account/security UX, and fragmented frontend primitives. Addressing shell consolidation, shared UI primitives, and schema expansion will reduce ongoing drift and improve maintainability.

No code changes made in this review.
