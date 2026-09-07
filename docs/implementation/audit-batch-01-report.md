# Audit batch 01 report — M-01, M-02, M-05

Date: 2026-09-07. Scope: workspace/tenant/session authorization holes (M-01),
share-link/project/guest policy enforcement (M-02), auth/session model consistency
(M-05). Ledger IDs: FD-AUD-007..011, FD-AUD-039..042, FD-AUD-047, UX-AUD-019,
UX-AUD-065..070. No other workstream was touched.

Per `docs/implementation/audit-batch-00-report.md`'s own caveat, its file→workstream
table was **routing, not proof of correctness** — this pass independently re-read every
file below and re-verified against the running code, not against either audit's prior
claims.

## 1. Verified-only (already correct, no change made)

- `backend/app/modules/workspaces/router.py`'s `get_workspace` intentionally omits
  `require_workspace_match` — it's the pre-workspace-context picker endpoint, and
  `workspace_service.get_workspace` checks `MembershipRepository.find(workspace_id,
  requesting_user_id)` at the service layer instead (`service.py:95-109`). Correct by
  design, not a hole.
- Every other `{workspace_id}`-scoped router (`clients`, `dashboard`, `projects`,
  `workspaces`) already calls `require_workspace_match(session, workspace_id)` on
  every route. Verified with `rg -n "require_workspace_match" backend/app/modules/*/router.py`.
- `core/actor_access.py`'s `resolve_actor_project_access` correctly checks both member
  (workspace-token) and guest (share-link-scoped) project access, including archived-
  project and expired/revoked-link cases.
- `comments/service.py`'s guest/member layer separation (`_broadcast_comment_event`,
  guest replies restricted to `layer == "client"` threads, guest-authored comments
  forced to `layer="client"`) is correct and unchanged.
- `GuestSessionCreate.display_name`'s Pydantic `min_length=1` was already preventing a
  *fully absent* field, but not a policy-aware requirement — see change #6 below.

## 2. Changed items

### M-01 — authorization holes

1. **`backend/app/modules/integrations/router.py`** — `list_integrations` and
   `create_integration` took `workspace_id` from the URL path but never called
   `require_workspace_match`; a valid owner/admin token for workspace A could list or
   create integrations under any other workspace's `{workspace_id}` segment. Added
   `require_workspace_match(session, workspace_id)` to both (matches every sibling
   router's pattern). `disconnect_integration`/`create_clickup_task`/`create_trello_card`
   were already correct (they derive `workspace_id` from the session via
   `require_workspace_context`, not from the URL).
   - Test: `backend/tests/test_integrations.py::test_cannot_list_integrations_for_another_workspace`,
     `::test_cannot_create_integration_for_another_workspace`.

2. **`backend/app/modules/pages/router.py` + `service.py`** — `PATCH /pages/{id}` and
   `DELETE /pages/{id}` used `get_current_actor` (member **or guest**) with
   `resolve_actor_project_access`, so any guest reviewer with a valid share-link token
   could rename or delete a project's pages. There is no guest row for page management
   in `13-Authentication.md` §13.5's permission matrix (guest page *registration* via
   `POST /pages` is a deliberately separate, idempotent, widget-driven flow and was left
   untouched). Both routes now depend on `require_permission("project:manage")` and pass
   a resolved `workspace_id`, matching `GET /projects/{id}/pages`'s existing pattern.
   Service functions `update_page`/`delete_page` were changed from `actor: Actor` to
   `workspace_id: str` accordingly.
   - No frontend caller was broken: `apps/web/src/features/projects/ProjectPagesModal.tsx`
     (the only client of these routes) already authenticates as a member via `apiFetch`.
   - Tests: `test_pages.py::test_guest_cannot_update_a_page`,
     `::test_guest_cannot_delete_a_page`, `::test_member_can_rename_a_page_but_not_across_workspaces`.

3. **`backend/app/modules/auth/service.py` + `repository.py`** —
   `revoke_session_family` had a literal `# Optional: verify family belongs to user`
   comment and did **not** check ownership: any authenticated user could revoke any
   other user's refresh-token family by supplying its `family_id`, since family ids are
   opaque tokens not derived from `user_id`. Added
   `RefreshTokenRepository.family_belongs_to_user(family_id, user_id)` and made
   `revoke_session_family` raise `NotFoundError` (404, not 403 — no leakage of which
   family ids exist) when the family isn't the caller's.
   - Tests: `backend/tests/test_sessions.py::test_cannot_revoke_another_users_session_family`,
     `::test_revoking_unknown_family_id_is_404_not_500`, `::test_revoke_own_session_family_succeeds`.

4. **Project-scoped ACL (audit's "decide explicitly" item) — not implemented, decision
   recorded here instead.** Per section 12, assumption #1 of the audit itself
   ("whether project-scoped collaborator ACLs are actually desired now... requires
   explicit confirmation/TDR rather than silent implementation"), and per the source
   precedence order (TDR/spec > audit prescription), I did not build a new
   `project_collaborators` + `require_project_access` model in this batch. Current
   behavior — every workspace member (owner/admin/member role) has access to every
   project in their workspace, with no finer per-project grant — matches
   `13-Authentication.md` §13.5's permission matrix exactly (workspace role is the only
   axis; there is no "project member" concept anywhere in the accepted spec or any
   TDR). Building project ACLs now would be new product scope, not an authorization bug
   fix, and needs its own TDR before implementation. Flagging as open per audit
   assumption #1, not silently resolving it either way.

### M-02 — share-link/project/guest policy enforcement

5. **New `backend/app/modules/share_links/policy.py`** — centralizes the three
   share-link policy checks that had real enforcement points available
   (`resolve_guest_display_name`, `check_domain_restriction`, `check_export_permission`),
   per the audit's "centralize `check_share_policy()`... apply at every relevant
   operation" instruction. Single source of truth, same pattern as
   `core/permissions.py`.

6. **`ask_reviewer_name` enforcement** — was stored on every share-link write path but
   never read back. `GuestSessionCreate.display_name`'s Pydantic constraint relaxed
   from `min_length=1` to `default=""` (schema-level length only); the actual
   requirement is now enforced server-side in `create_guest_session` via
   `resolve_guest_display_name`: a link with `ask_reviewer_name=True` rejects a blank/
   whitespace-only name with 422; a link with `ask_reviewer_name=False` accepts a blank
   submission and normalizes it to `"Guest"` so `comments/service.py`'s
   `_resolve_author_name` never renders an empty string. `ReviewResolveOut` gained an
   `ask_reviewer_name: bool` field so `ReviewEntryPage.tsx`'s name field can hide/show
   itself for UX convenience — the server re-enforces regardless of what the client
   sends.
   - Tests: `test_share_links.py::test_ask_reviewer_name_rejects_blank_name_when_required`,
     `::test_ask_reviewer_name_false_allows_blank_name_with_default`.

7. **`domain_restrictions` enforcement** — was stored but never checked anywhere.
   `create_guest_session` now calls `check_domain_restriction(link, origin, referer)`
   against the **request's own `Origin`/`Referer` headers** (read in
   `share_links/router.py` from `request.headers`, never a client JSON field) —
   satisfies the audit's explicit "never trust a client-provided origin string alone."
   Matching is exact-host or subdomain-of-allowed-host; a link with no restrictions
   configured behaves exactly as before (open).
   - Tests: `test_share_links.py::test_domain_restriction_blocks_unapproved_origin`
     (blocked origin, missing origin, exact match, subdomain match all covered),
     `::test_no_domain_restriction_allows_any_origin`.

8. **`comment_export_permission`** — `check_export_permission` is implemented in
   `policy.py` but **intentionally not wired to any route in this batch**: the only
   existing export endpoint, `GET /projects/{id}/export`
   (`projects/router.py:140`), is member-only (`require_permission("project:manage")`)
   and has no guest-facing counterpart at all. There is nothing to gate — the flag is
   evidence of a not-yet-built guest-export feature, not an unenforced authorization
   hole today. The helper is left in place so that feature lands with enforcement
   already available instead of a second silent write-only field. Flagging as a
   dependency for whichever future workstream builds guest-facing export.

9. **`reviewer_can_resolve` — not enforced; explicit conflict, not a silent gap.**
   `13-Authentication.md` §13.5's permission matrix hardcodes "Change comment
   status/assignee: **No (never)**" for guests, as a spec-level constant, not
   conditional on any project setting. There is also no guest-reachable "resolve"
   endpoint anywhere in `comments/router.py` — every status-changing route
   (`PATCH /comments/{id}`, `/layer`, `/reanchor`) requires
   `require_permission("comment:update_status"/"toggle_layer"/"reanchor")`, all
   member-only in `core/permissions.py`'s `PERMISSIONS` dict. Per source-of-truth
   precedence (accepted spec > audit prescription), wiring `reviewer_can_resolve` to
   let a guest resolve their own comment would **regress an accepted architecture
   decision**, which the audit's own precedence rules explicitly forbid ("Never 'fix
   parity' by regressing an accepted architecture decision"). This needs a superseding
   TDR amending §13.5 before implementation, not a policy-enforcement patch. Left
   exactly as found (stored, unread) and documented here as the reason.

10. **`show_board_to_client` — not enforced; no gate exists to build against safely
    in this batch's scope.** There is no guest-facing board/ticket-list endpoint in
    this codebase at all — `dashboard/router.py`'s `/dashboard`, `/tickets`,
    `/search`, `/activity` routes are all `require_permission("comment:view_team")`,
    member-only, and reachable only after `require_workspace_match`. A guest's board
    view (per FD-AUD-042/M-04's "show ticket board to client" setting) is genuinely
    unbuilt product surface, not a leak of an existing one. Building the client-safe
    board DTO/endpoint the audit describes ("must produce a deliberately client-safe
    DTO/endpoint; do not reuse staff board payload") is new-feature scope belonging to
    M-04 (persisted project review settings + enforcement), not this authorization
    batch. Flagged, not implemented.

### M-05 — auth/account/session model consistency

11. **`backend/app/modules/auth/schemas.py` — `SessionOut` date typing.**
    `created_at`/`last_active_at` were hand-formatted `str` fields
    (`.isoformat().replace("+00:00", "Z")` in the service). Changed to typed
    `datetime`, matching the audit's explicit "user preference/session date fields must
    be typed datetimes in API contracts" requirement and Rule 2 (Pydantic-first API
    contracts). `auth/service.py::list_sessions` now returns the raw `datetime` and lets
    the `response_model` handle wire serialization. Verified frontend compatibility:
    `apps/web/src/features/auth/api.ts`'s `SessionOut.created_at`/`last_active_at` are
    already typed `string` and `AccountModal.tsx` already does `new Date(s.last_active_at)`
    — no frontend change needed, ISO-8601-with-offset from Pydantic parses identically.
    - Test: `test_sessions.py::test_list_sessions_returns_typed_datetimes`.

12. **OTP ergonomics (`apps/web/src/features/auth/LoginPage.tsx`)** — real gaps closed:
    - `autoComplete="one-time-code"` on the code input, `autoComplete="email"` on the
      email input (previously neither field had `autoComplete` set at all).
    - Paste handling: pasting a 6-digit code into the code field now strips non-digits
      and fills the field directly (`onPaste`), and typed input is also sanitized
      (`replace(/\D/g, "")`) so a code with stray characters from a copied SMS/email
      body still works.
    - Resend: previously there was no way to request a second code without going back
      to the email step and re-submitting (which the UI didn't even make obvious was
      possible while the code step was showing). Added a "Resend code" button with a
      30s cooldown, reusing the existing `requestOtp`.
    - Expiry countdown: a live `M:SS` countdown matching the backend's actual 10-minute
      OTP TTL (`13-Authentication.md` §13.2), with the submit button disabled once it
      hits zero, so a user isn't left submitting a code the server will already reject.
    - Error/input association: both inputs now carry `aria-describedby`/`aria-invalid`
      pointing at the (now `id`'d, `role="alert"`'d) error message — previously the
      error `<p>` had no relationship to either input at all.
    - Focus management: the code input auto-focuses when the code step mounts.
    - Explicitly did **not** add password sign-in/reset, autofocus-stealing
      `autocomplete="webauthn"`, or any other prototype-only auth surface — OTP +
      Google remains the only auth model, per the audit's own explicit instruction.

13. **`ReviewEntryPage.tsx`** — name field now conditionally required based on the
    server-computed `ask_reviewer_name` (see change #6), and gained
    `autoComplete="name"`.

14. **`packages/types/openapi.json` + `packages/types/src/openapi.ts`
    regenerated** from the actual FastAPI app (`app.openapi()`, no DB connection
    required) to pick up `ReviewResolveOut.ask_reviewer_name` and `SessionOut`'s
    datetime fields — required per Rule 2.3 ("Generate TypeScript API types from
    OpenAPI. Do not manually duplicate DTOs.") and to keep `apps/web` compiling.
    **Caveat:** the regenerated file's diff (790/597 lines) is larger than this
    batch's own schema changes account for — the committed `openapi.json` was already
    stale relative to schema changes from earlier, unrelated batches (e.g.
    `ProjectSettingsOut`'s M-04 fields, ticket schemas) that were never regenerated
    after being written. Regenerating was still correct (a stale generated artifact is
    itself a drift bug per M-21's "OpenAPI generation produces no uncommitted type
    drift" gate), but the resulting diff is not fully attributable to M-01/M-02/M-05 —
    flagging so a reviewer doesn't assume the whole diff is this batch's schema
    surface.

## 3. Remaining risks / divergences

- **TDR-0006 dependency for M-15 (widget realtime gap) — explicitly not addressed
  here, per instructions.** TDR-0006 records that the widget has no WS event for a
  comment leaving the guest-visible layer (`team -> client` publishes correctly;
  `client -> team` does not, since the spec's event table has no
  `comment.deleted`/`comment.hidden` type), and that the widget has never rendered a
  list of existing comments as pins at all — only comment *creation*. My M-02 work
  (`domain_restrictions`, `ask_reviewer_name`, and the policy centralization) does
  **not** depend on or attempt to fix this, but any future work that assumes a guest's
  widget reactively removes a comment it can no longer see, or reflects a live layer
  toggle, will hit this exact gap. This is real, unsolved, and belongs to whichever
  session picks up M-15 — flagging per the task's explicit instruction, not attempting
  a fix.
- **`reviewer_can_resolve` and `show_board_to_client`** remain stored-but-unenforced
  by design (see items #9/#10) pending a product decision/TDR and, for the board case,
  an actual guest-facing endpoint to build against. Both are honest no-ops right now —
  no misleading UI implies either works — but a reviewer picking up M-04 (persisted
  project review settings + enforcement) should start from this report rather than
  re-discovering the same gap.
- **`comment_export_permission`** has a ready enforcement helper
  (`policy.check_export_permission`) but no caller — same "flag for the feature that
  eventually needs it" situation as above.
- **Project-scoped ACL** (audit item #4 above) remains an open product question, not a
  code defect - recorded per the audit's own assumption list rather than resolved
  either way.
- **Widget's own name prompt doesn't consult `ask_reviewer_name`.** The widget
  (`apps/widget/src/guest-session.ts`) always calls `promptForName()`, regardless of
  the link's policy; server-side enforcement (item #6) is correct regardless of what
  the widget sends, but the widget's own UX doesn't yet skip the prompt when the
  policy says not to ask. Left as-is since it's UX polish on a code path outside this
  batch's file list (`apps/widget`), not a security or correctness defect — the server
  never trusts the client's choice either way.

## 4. Test results

### Static verification (actual command output)

Backend (`backend/.venv/Scripts/python.exe`, Python 3.14 venv found in the repo):

```
$ python -m py_compile app/modules/integrations/router.py app/modules/pages/router.py \
    app/modules/pages/service.py app/modules/auth/repository.py app/modules/auth/service.py \
    app/modules/auth/schemas.py app/modules/share_links/service.py app/modules/share_links/router.py \
    app/modules/share_links/schemas.py app/modules/share_links/policy.py
COMPILE_OK

$ python -c "import app.main"
(no output — imports cleanly, no DB connection required at import time)

$ python -m ruff check <all files touched by this batch>
(0 new errors — every remaining ruff finding on those files, e.g. auth/service.py's
pre-existing single-line if/elif User-Agent parser and share_links/service.py's
pre-existing mutable-default `domain_restrictions: list[str] = []`, predates this
batch and was left untouched, in scope for a future lint-cleanup pass, not this one)

$ python -m mypy app/modules/integrations/router.py app/modules/pages/router.py \
    app/modules/pages/service.py app/modules/auth/repository.py app/modules/auth/service.py \
    app/modules/auth/schemas.py app/modules/share_links/service.py app/modules/share_links/router.py \
    app/modules/share_links/schemas.py app/modules/share_links/policy.py
Success: no issues found in 10 source files
(one pre-existing, unrelated mypy error in auth/repository.py's aggregate() pipeline
typing, and one pre-existing error in pages/service.py's update_page were found before
my edit; the pages/service.py one was fixed in passing with an `assert updated is not
None` since I was already touching that function — see change #2's diff)

$ python -c "<inline check of share_links/policy.py's functions against 6 scenarios>"
OK: blocked evil origin / OK: allowed exact / OK: allowed subdomain /
OK: blocked missing origin / OK: blank name rejected when required /
resolved: 'Guest' / resolved: 'Real Name'
(all 7 assertions passed — see §2 change #5-7 for what this exercises)
```

Frontend (`apps/web`):

```
$ npx tsc -b --noEmit
(no output — clean)

$ npx eslint src/features/auth/LoginPage.tsx src/features/review/ReviewEntryPage.tsx
(no output — clean)
```

Widget (`apps/widget`):

```
$ npx tsc --noEmit
(no output — clean; guest-session.ts's payload shape is unaffected by the relaxed
GuestSessionCreate.display_name constraint since it always sends a real prompted name)
```

### Backend integration test suite — NOT executed; environment limitation, not a claim of passing

`backend/tests/conftest.py` requires a live MongoDB (`mongodb://localhost:27017`) and
Redis (`redis://localhost:6379`) — this repo has no Docker available in this sandboxed
session (`docker ps` fails: no Docker daemon reachable) and TDR-0001's native-binary
fallback (`infra/local/start-mongo.sh` / `start-redis.sh`) requires `mongod`/
`redis-server` binaries that are not installed on this machine. A `choco install
mongodb redis-64` attempt failed for lack of admin/elevated rights (no `sudo`
equivalent available either). I did not fabricate a "tests pass" claim — the four new/
extended test files (`test_pages.py`, `test_integrations.py`, `test_sessions.py`,
`test_share_links.py`, 13 new test functions total) were written against the actual
route/service/schema code, syntax- and type-checked clean, and their assertions were
independently verified against `share_links/policy.py`'s logic via the inline Python
check above — but they have not been run end-to-end against real Mongo/Redis in this
session. Whoever next has Docker or the native binaries available should run:

```
cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_pages.py \
  tests/test_integrations.py tests/test_sessions.py tests/test_share_links.py -q
```

before considering this batch's tests "green," and should also re-run the full
`pytest` suite once, since `SessionOut`'s type change and the `pages/router.py`
signature change are exactly the kind of edit that can silently break an unrelated
existing test that happened to depend on the old shape.

## 5. Files touched

- `backend/app/modules/integrations/router.py`
- `backend/app/modules/pages/router.py`, `backend/app/modules/pages/service.py`
- `backend/app/modules/auth/repository.py`, `service.py`, `schemas.py`
- `backend/app/modules/share_links/service.py`, `router.py`, `schemas.py`
- `backend/app/modules/share_links/policy.py` (new)
- `backend/tests/test_pages.py`, `test_integrations.py`, `test_share_links.py`
- `backend/tests/test_sessions.py` (new)
- `apps/web/src/features/auth/LoginPage.tsx`
- `apps/web/src/features/review/ReviewEntryPage.tsx`
- `packages/types/openapi.json`, `packages/types/src/openapi.ts` (regenerated)
