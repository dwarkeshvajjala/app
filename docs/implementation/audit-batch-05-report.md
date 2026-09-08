# Audit Batch 05 — M-11/M-12 verification and integration fixes

Date: 2026-09-08

Scope: M-11, M-12 (section 5), FD-AUD-002..017 and UX-AUD-011..018/032..040.

## Findings and changes

- Reverified the shell wiring. `WorkspaceSwitcherPopover` is mounted by `DashboardSidebar`; `AccountModal` is opened by the top-bar account button in `WorkspaceLayout`.
- Removed the duplicate `/workspaces/{workspace_id}/search` route. The TDR-0013 bounded, workspace-scoped search implementation is now the only handler, so client contacts are excluded and the generated result contract is served consistently.
- Added robust workspace loading/error states, retry handling, focus return, keyboard navigation, outside-click close, slug preview, and route-owned token switching. Workspace switches now resolve through `useWorkspaceContext` before rendering the destination.
- Added notification read/load error handling, target validation, and a workspace/project fallback when a stored target is missing, unauthorized, or deleted. Notification preferences now gate instant notification creation.
- Added route breadcrumbs, retry recovery, loading skeletons, and focus restoration for navigation.
- Replaced placeholder project status ratios with persisted per-project status counts. Added clear-filter behavior and honest deterministic illustration labels for card previews; removed fabricated pin markers.
- Tightened the project wizard state transitions, duplicate-submit protection, upload retry/removal behavior, URL validation, inline client creation, and consistent SVG rejection across browser and API upload paths. Existing stored assets remain readable.

## Verification

Per request, no test suites were run. Static and manual verification performed:

- Backend Ruff: passed.
- Backend mypy: passed (`153` source files).
- Workspace scoping check: passed (`17` repository files).
- Web TypeScript typecheck: passed.
- Web ESLint: passed with three pre-existing warnings in `ActivityPage.tsx` and `ViewportMenu.tsx`.
- Web production build: passed. Existing Vite warning remains for a large PDF worker/vendor chunk.
- Widget production build: passed; 11.72 KB gzipped SDK bundle.
- Browser walkthrough completed through sign-in, workspace creation, slug preview, project wizard type/details/client flow, workspace switching popover, and dashboard rendering.

The isolated Redis emulator accepted persistence operations but did not deliver the pub/sub message expected by the existing notification websocket check; no application test suite was used to claim this as resolved. Live Mongo/Redis/S3 deployment health remains environment-dependent.

