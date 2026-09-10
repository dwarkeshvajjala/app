# Backend completion plan (MASTER_PROMPT.md Part 11)

**Date:** 2026-09-11. This replaces the assumption in `MASTER_PROMPT.md` that most of
this is greenfield work — a direct read of `backend/app/modules/` found three of the
five areas substantially already built. This doc corrects the record and scopes only
the real remaining gaps.

## 1. Sessions module — DONE

- `POST /auth/logout` — revokes the current refresh-token family. Exists
  (`backend/app/modules/auth/router.py:91`).
- `DELETE /auth/sessions/{family_id}` — revokes one session; `family_id="all"` routes
  to `revoke_all_sessions` (revokes every refresh token for the user, current session
  included — verified in `auth/service.py:297`). Exists and correct.
- `GET /auth/sessions` — lists active sessions with OS/browser/IP/current-flag via
  `list_sessions` in `auth/service.py`. Exists.
- **Fixed this session:** the frontend side of "logout everywhere" didn't force a
  local logout/redirect/cache-clear after the (correct) backend call — see
  `AccountModal.tsx`/`AuthContext.tsx`, commit `3445e67`.

No further backend work needed here.

## 2. Comments browser field — DONE

- `ContextIn`/comment schema already has `browser: str` (`comments/schemas.py:58`),
  populated per-comment and returned in `CommentOut.context`.
  `FilterSortBar.tsx` already filters by it.
- **Fixed this session:** the one real gap was that the *value* was always the
  viewer's real `navigator.userAgent` detection — the dashboard's BrowserMenu
  ("CAPTURE AS X") selection never reached the widget. Wired via a `blBrowser` query
  param on the iframe reload (same channel as the existing `blMode` param) — see
  `apps/widget/src/index.ts` / `ProjectOverviewPage.tsx`, commit `3445e67`.

No migration needed — the field already existed.

## 3. Integrations backend — MOSTLY DONE, two real gaps

`backend/app/modules/integrations/` already has a real persistence + delivery layer:

- `IntegrationType = Literal["slack", "clickup", "trello"]` (`schemas.py:6`).
- Slack: incoming-webhook only (`slack.py`, no OAuth — matches spec §17.2's
  deliberate "no app review needed for MVP" decision, and matches Part 12's own
  "outbound alerts only for now" ask).
- ClickUp: real OAuth code exchange, `oauth_token_encrypted` stored via
  `app.core.encryption` (Fernet, `encrypt_secret`/`decrypt_secret`). Frontend has a
  real callback page (`ClickUpOAuthCallbackPage.tsx`).
- Trello: API-key + token pasted by the user (matches TDR-0009's documented decision
  not to register a Backline Power-Up app).
- Endpoints: `GET/POST /workspaces/{id}/integrations`, `DELETE /integrations/{id}`,
  plus per-comment actions `POST /comments/{id}/integrations/clickup/create-task` and
  `.../trello/create-card` (`integrations/router.py`).
- Real frontend settings page (`apps/web/src/features/integrations/IntegrationsPage.tsx`)
  is wired to all of this. **This is what the honest-preview copy in `IntegrationsTab.tsx`
  ("connect a provider from the workspace Integrations settings to make it real")
  refers to** — it's not a placeholder pointing at nothing.

**Real gaps:**
1. **Jira and Asana are not implemented at all** — `IntegrationType` has no `"jira"`/
   `"asana"` variant, no `jira.py`/`asana.py`. `IntegrationsTab.tsx`'s quick-access
   panel still lists them as options with zero backend behind either. Scope for a
   follow-up: Jira (OAuth 2.0 3-legged + REST v3 issue creation, mirrors the ClickUp
   shape) and Asana (OAuth 2.0 + task creation, same shape). Both fit the existing
   `IntegrationCreate` discriminated-union pattern — add
   `JiraIntegrationCreate`/`AsanaIntegrationCreate` variants and matching
   `create_jira_issue`/`create_asana_task` service functions + router actions.
2. **No webhook delivery/retry table.** `integrations/events.py` only defines a
   `WEBHOOK_DELIVERY_FAILED` event constant — a failed Slack post is logged as an
   activity event, not queued for retry. See §5 below (shared with Part 12) for the
   proposed `webhook_deliveries` collection.

## 4. AI credits/usage — NOT BUILT (confirmed, real gap)

`backend/app/modules/ai/` exists (`summarize_thread`, `suggest_reply`, both backed by
Google Gemini via `GEMINI_API_KEY` — see the note on provider choice in
`docs/implementation/slack-ai-mcp-architecture.md`, this is a decision point for the
user, not something this pass changed) but there is genuinely no credit/usage
concept anywhere in the codebase (confirmed via repo-wide grep for
`ai_usage`/`ai_credits`/`credit`).

Proposed schema:
```
ai_usage_counters (one doc per workspace per calendar month)
  _id: "<workspace_id>:<YYYY-MM>"
  workspace_id: ObjectId
  period: "YYYY-MM"
  summarize_calls: int
  suggest_reply_calls: int
  updated_at: datetime

workspaces.settings_json.ai_credits_monthly_limit: int | null   (null = unlimited / plan-gated elsewhere)
```
Service-layer: a `check_and_increment_ai_usage(db, workspace_id, kind)` called at the
top of both `summarize_thread`/`suggest_reply`, raising a 429-style
`QuotaExceededError` when the monthly counter would exceed the workspace's plan
limit. Frontant: `UsagePage.tsx` reads the counter via a new
`GET /workspaces/{id}/ai-usage` endpoint; `AiTab.tsx` disables the summarize/suggest
buttons and shows the same "upgrade" messaging `BillingPage.tsx` already has a slot
for.

**Also flagging while in this code** (not blocking, but real): `ai/router.py`'s own
comment says "Basic auth check: just verify user is authenticated for MVP" — it
checks the comment's `workspace_id` matches the URL's `workspace_id` (blocks
cross-workspace comment access) but never checks the calling user is actually a
*member* of that workspace, unlike every other workspace-scoped endpoint in this
codebase (which use `require_workspace_match`/`require_permission`). Low real risk
(needs a valid, non-guessable `comment_id`) but worth closing alongside the credits
work rather than separately, since both touch this same router.

## 5. Every endpoint checklist (Part 11's own ask)

For the two genuinely new pieces above (Jira/Asana integrations, AI usage
counters) when built: require auth (`require_permission`/`require_workspace_match`
per this codebase's existing convention, not just `get_current_actor`), proper HTTP
status codes (404 for not-found, 403 for permission, 429 for quota), Pydantic
input validation (matches the existing discriminated-union pattern), OpenAPI docs
(regenerate via `backend/scripts/export_openapi.py` +
`npx openapi-typescript` in `packages/types`, both confirmed working without a DB
connection — see memory `audit-batch-03-verification`), and at least one
happy-path + one failure-path test using this repo's `client` fixture convention
(`backend/tests/test_*.py`, not direct service-layer calls).

## 6. Billing/plans spec (Part 10 — short spec only, per the prompt's own scoping)

Current state confirmed still accurate: `BillingPage.tsx` shows only the stored
`workspace.plan` label with an honest "coming soon" note — no fake pricing, no
checkout affordance. Short spec for the eventual real build:

- **Plan tiers**: Free / Solo / Team / Enterprise (matches the reference file's
  4-tier comparison grid). Each tier: `project_limit`, `member_limit`,
  `ai_credits_monthly` (ties into §4 above), `integrations_allowed: list[str] | "all"`.
- **Schema**: `workspaces.plan` already exists as a stored string — add
  `workspaces.plan_limits_json` (denormalized snapshot of the tier's limits at
  purchase time, so a later tier-definition change doesn't retroactively change what
  an existing customer already paid for) and a `billing_events` collection
  (`workspace_id, type: "upgraded"|"downgraded"|"payment_failed", from_plan, to_plan,
  provider_ref, created_at`) as the audit trail.
- **Enforcement**: a `require_within_plan_limit(db, workspace_id, kind)` dependency,
  same shape as the proposed `check_and_increment_ai_usage` in §4, called from
  `projects/service.py::create_project` and `workspaces/service.py::add_member`.
- **Checkout provider**: not picked here — Stripe is the conventional default for a
  product without India-specific payment needs already decided; per
  `audit-batch-03-verification`, the user has separately said they're evaluating
  Stripe/Razorpay/PayPal, so don't build against one until that's settled.
- **Cmd/Ctrl+Z undo** (also Part 10, lowest priority): no current equivalent to the
  reference file's global undo. Out of scope for this pass; needs its own design
  (what's undoable — a comment edit, a ticket status change, a delete? — and how far
  back the undo stack reaches) before estimating, not just a keybinding.

## Priority for a follow-up pass

1. AI usage counters + the missing membership check on `ai/router.py` (smallest,
   most self-contained, closes a real though low-severity gap).
2. Jira integration (Asana can mirror it once the pattern is proven).
3. Webhook delivery/retry table (shared with Part 12 — see that doc).
4. Billing schema (§6) — only once a payment provider is actually chosen.
