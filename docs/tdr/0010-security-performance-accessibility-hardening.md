# TDR-0010: Security, Performance & Accessibility Hardening (M11)

Date: 2026-07-13
Status: Accepted

## Workspace-scoping audit (06-Backend-Architecture.md §6.4)

Manually audited every `db.<collection>.<method>(...)` call across every
`app/modules/*/repository.py` file. **Zero cross-tenant data-leakage vulnerabilities
found** - the "find-by-id-then-verify-workspace_id-then-mutate" pattern used throughout
`service.py` files has held up since M1. Two real, minor issues were found and fixed
instead:

- `NotificationRepository.mark_read` filtered only by `_id` + `user_id`, missing
  `workspace_id` in the query itself (defense-in-depth gap, not an exploitable one -
  `user_id` alone already scopes it to the right person). Fixed by adding
  `workspace_id` as a required kwarg threaded through `service.py` and the router.
- Three genuinely dead repository methods, never called anywhere:
  `IntegrationRepository.update_config`, `RevisionDiffRepository.find_by_to_revision`,
  `GuestSessionRepository.touch_last_seen`. Deleted rather than left as unscoped
  scaffolding a future caller might copy without adding a workspace filter.

### Decision: exemption-comment convention, not a stricter literal rule

`backend/scripts/check_workspace_scoping.py` is a new stdlib-only AST script (no new
ruff plugin) that flags any `find`/`find_one`/`update_one`/`update_many`/`delete_one`/
`delete_many`/`count_documents` call against a non-global collection whose filter dict
literal has no `workspace_id` key - unless the call has a
`# workspace-scope-exempt: <reason>` comment on its own line or the line(s) directly
above it. A naive "every query must literally contain workspace_id" rule would have
flagged dozens of legitimate call sites that filter by an already-workspace-verified
`_id`/`page_id`/`project_id`/`share_link_id` instead; this way every exemption is an
explicit, reviewed, in-code decision, and a genuinely new gap still fails CI.

Caught one real bug in the script itself during rollout: multi-line exemption comments
only carry the `workspace-scope-exempt:` marker on their first line, and a multi-line
`db.<collection>.<method>(...)` call's AST node `lineno` points at wherever the method
name token starts (not necessarily the statement's first line, e.g. inside a
parenthesized `cursor = (\n  self.db.x.find(...)` expression) - the original
line-immediately-above check missed both. Fixed by walking upward through the whole
contiguous comment block instead of just one line.

Wired into CI (`backend` job) as its own step plus
`backend/tests/test_workspace_scoping_lint.py` (runs the script via subprocess, asserts
exit 0) so a regression fails both fast (dedicated step) and in the normal test run.

## Rate limiting audit (12-API-WebSocket.md §12.7)

Found six write endpoints reachable by an unauthenticated guest session with **zero**
rate limiting - `/auth/otp/request`, page registration, snapshot submission, comment
creation (and replies), and upload-URL issuance - unlike `/review/{token}`,
`/guest-sessions`, and `/proxy/...` which already had it from earlier milestones. A
guest share-link token was effectively a free pass to spam any of these.

Fixed by extending the existing Redis sliding-window `check_rate_limit` (`core/
rate_limit.py`) to all six, via a new `actor_rate_limit_key()` helper implementing
§12.7's member-vs-guest distinction: authenticated members are keyed per-workspace (one
tenant's runaway script can't degrade another tenant), guests fall back to per-IP (the
same bucket already used for `/guest-sessions`). New settings in `core/config.py`:
`otp_request` (5/min), `page_register` / `snapshot_submit` (30/min), `comment_create`
(20/min, shared between create-comment and create-reply), `upload` (20/min). Covered by
`backend/tests/test_rate_limiting.py` (six tests: one per endpoint plus one proving a
member's requests are bucketed by workspace, not IP).

## Signed URL expiry review (18-Storage-Deployment.md §18.2/§18.3)

Presigned PUT (5 min) and GET (1 hr) TTLs already matched spec. Found one gap: presigned
GET responses were missing the `Cache-Control: private, max-age=300` header §18.3 asks
for (the URL itself is signed and rotates, so a long/absent cache lifetime works against
that). Fixed in `r2_client.py`'s `generate_presigned_get` via `ResponseCacheControl`.

## Dependency security audit

- `pip-audit` (backend): no known vulnerabilities.
- `pnpm audit --audit-level=high` (frontend): one high-severity Vite advisory
  (`server.fs.deny` bypass on Windows, GHSA-fx2h-pf6j-xcff) plus a related moderate
  esbuild advisory, both only fixable by moving off the vite 5.x line entirely (no
  backported patch exists in 5.4.x). Upgraded `vite` to `^6.4.3` and
  `@vitejs/plugin-react` to `^4.6.0` (the earliest 4.x release with a vite-6 peer
  range) in both `apps/web` and `apps/widget`; re-ran `pnpm turbo run lint typecheck
  build` and the full e2e suite afterward to confirm nothing regressed. `pnpm audit
  --audit-level=high` now reports no known vulnerabilities. Both steps are now wired
  into CI so a new high/critical finding fails the build going forward.

## Accessibility: axe-core pass (WCAG AA)

New `apps/e2e` pnpm workspace package: Playwright + `@axe-core/playwright`, walking
every dashboard screen (login, workspace picker, workspace home empty/populated,
members, integrations, project overview, board kanban/list, share links) in one test
via `expect.soft` (a real violation on one screen shouldn't hide findings on the rest),
plus a second test scanning the widget's shadow-root UI (name prompt, then the composer
after a real click-to-pin) served from `apps/widget/test-site/index.html` against a
real share token generated through the actual dashboard flow.

Real findings, all fixed:
- Members page: the invite-role `<select>` had no accessible name (`select-name`,
  critical) - added `aria-label`.
- Board page: all five filter `<select>`s, the per-comment status `<select>`, the bulk
  status-change `<select>`, and both the header/row bulk-select `<checkbox>`s had no
  accessible name - added `aria-label` to each (the per-comment and bulk-action controls
  weren't hit by the walk itself, since the fresh test project starts with zero
  comments, but they're the identical defect, so fixed proactively rather than left for
  a future test to happen to exercise that state).
- Project overview page: the read-only share-link `<input>` had no accessible name -
  added `aria-label="Share link"`.
- App-wide: `recovery-orphaned` red (`#EF4444`, used for every destructive/error
  action's text - "Remove", "Revoke", form errors) measured 3.51:1 against
  `bg-canvas`, short of AA's 4.5:1 for normal text. Darkened to `#B91C1C` (~6:1).
  Dark-mode contrast wasn't a factor: `darkMode: "class"` is configured but nothing in
  the app ever adds the `dark` class, so dark-mode styling is currently unreachable in
  practice - a real gap, but a pre-existing and separate one from this audit's scope.
- Widget: the name-prompt `<label>` wasn't associated with its `<input>` (no `for`/`id`
  pair), and the composer `<textarea>` had no accessible name at all - fixed both in
  `apps/widget/src/ui.ts`.

An axe-core-playwright + pnpm's isolated `node_modules` combination surfaced one
tooling gotcha worth recording: `@axe-core/playwright`'s CDP-based `analyze()` doesn't
reliably attach to a page created via the `browser.newPage()` convenience shortcut -
it needs an explicit `browser.newContext()` → `context.newPage()`.

## Performance: Lighthouse budget (19-Testing-CI.md §19.5)

Budget is Time to Interactive < 2.5s on a throttled connection profile, audited via
`playwright-lighthouse` (drives a real Lighthouse run over the same CDP connection an
already-authenticated Playwright page is using, so it can audit the real board view
rather than an anonymous page). Two things worth recording:

- **Must audit the production build, not the dev server.** First run, against
  `vite dev`, measured a 14.3s TTI - not a real regression, just what auditing an
  unbundled, unminified dev server with hundreds of separate module requests actually
  looks like. Re-pointed at `vite preview` serving the real `apps/web/dist` build:
  passes comfortably under the 2.5s budget. The CI `test-e2e` job builds and serves the
  production bundle for exactly this reason.
- `playwright-lighthouse@4.0.0` has a real bug: omitting `thresholds` entirely crashes
  on a `chalk.yellow.italic` call in its own "no thresholds set" warning path, and
  passing an empty `{}` avoids that crash but then produces an empty `onlyCategories`
  list, which Lighthouse itself rejects. Passing `{ performance: 0 }` sidesteps both
  without ever failing the build on category score - the raw `interactive` metric is
  what's actually asserted against the 2500ms budget, not any category score.

## CI wiring

New `test-e2e` job (`.github/workflows/ci.yml`): starts mongo/redis/MinIO, boots the
real backend, builds and serves the frontend via `vite preview` (not `vite dev`, per
above), then runs the full `apps/e2e` suite (accessibility + widget + performance).
`backend` job gained a dedicated workspace-scoping-lint step and a `pip-audit` step;
`frontend` job gained a `pnpm audit --audit-level=high` step.
