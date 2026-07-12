# TDR-0008: Proxy Mode scope, and Milestone 9's onboarding decisions

Date: 2026-07-12
Status: Accepted

## Decision: the reverse proxy is deliberately not general-purpose

`03-System-Architecture.md` §3.3 describes proxy/link mode as "Backline reverse-proxies
the target site, injecting the SDK server-side" - true of the implementation
(`modules/proxy/`), but a fully general reverse proxy (arbitrary JS-driven sites, forms,
cookies, CSS `url()` references) is a multi-week project on its own, and this milestone
is budgeted 4-5 days (`20-Build-Plan.md`). What's built, deliberately scoped:

- **HTML rewriting is attribute-regex-based, not a full parser.** `modules/proxy/rewriter.py`
  rewrites `href`/`src`/`action` attributes that are root-relative or same-origin-absolute
  to route back through `/proxy/{token}/...`; everything else (different-origin links,
  fragments, `mailto:`/`tel:`/`javascript:`/`data:` URIs) is left untouched. Verified
  against a real external site (`https://example.com`) in `docs/tdr` verification, not
  just synthetic fixtures.
- **Not handled at all**: JS-driven navigation (`fetch`/`XHR`/`history.pushState` -
  a service-worker-based approach would be needed, out of scope), CSS `url(...)`
  references, `srcset`, non-GET requests (forms that POST elsewhere), and cookies from
  the target site (dropped entirely - upstream `Set-Cookie` is never forwarded, since
  this proxy doesn't maintain a session with the target on the guest's behalf).
- **Passcode gating happens at guest-session creation, not at proxy content-serving.**
  A passcode-protected share link's *content* is servable via `GET /proxy/{token}/...`
  without a passcode - only `POST /guest-sessions` (needed before commenting, and now
  before the dashboard's handoff redirect - see below) verifies one. Properly gating
  *viewing* would need a session cookie threaded through every proxied asset request,
  a meaningfully bigger feature than this milestone's scope. Reviewed sites are agency
  marketing/staging pages, not sites where unauthenticated content exposure is a
  meaningful risk in practice, but this is a real, known gap, not an oversight.
- **No upstream header forwarding.** CSP/X-Frame-Options from the target would block the
  very page Backline is now serving under its own origin; Set-Cookie is dropped per
  above. The router builds a fresh `Response` from just status/content-type/body.

## Decision: the dashboard is now the single, uniform guest handoff point

Before this milestone, `ReviewEntryPage` only proved share-link resolution and
guest-session creation - it never actually sent anyone to a live page ("Commenting on
the live page lands in Milestone 3" was the placeholder, itself already stale by the
time M3 shipped the widget as a separate creation-only flow). Now: after creating a
guest session (name + passcode, if required - the existing form, unchanged), it redirects
to whichever page mode dictates:

- **Proxy mode** -> `{apiBaseUrl}/proxy/{token}/?backline_guest=...&backline_name=...`
- **Snippet mode** -> `{target_origin}?backline_guest=...&backline_name=...` (the
  agency's own site, which already has the widget embedded via a `<script>` tag they added)

Both carry the just-created guest session as a query param, which the widget
(`apps/widget/src/guest-session.ts`) now checks *before* its own `sessionStorage` lookup
and *before* prompting for a name - so the guest never sees two name prompts back to
back. The widget strips the param from the URL bar via `history.replaceState` once read.

**Consequence**: `ReviewEntryPage` no longer persists its own guest session in
`sessionStorage` (removed, along with the now-dead `lib/guest-session-storage.ts`) -
revisiting the bare `/review/{token}` URL always re-collects a name and mints a new
guest session, even for someone who already has one. Bookmarking the *destination* URL
(the proxied page or the agency's site) still resumes seamlessly via the widget's own
`sessionStorage`, keyed by share token - only re-visiting the Backline-hosted entry page
itself re-prompts. Minor, not a correctness issue.

## Decision: F7's seeded sample project runs at `create_workspace`, not lazily

`modules/workspaces/onboarding.py`'s `seed_sample_project()` runs synchronously inside
`create_workspace` (one extra project + page + 3 comments, a few milliseconds) rather
than as a background job - it's small, fixed-cost, and needs to be present by the time
the create-workspace response returns so the immediately-following redirect to the new
workspace shows it with no race. Every new workspace gets one, not just a user's first
overall (tested in `test_second_workspace_from_the_same_user_is_also_seeded`) - each
workspace is its own onboarding experience.

## Decision: every new project gets a default proxy-mode share link automatically

`create_project` now also creates a share link (`mode="proxy"`, no passcode, no
expiry) in the same call - "install-free path first" (F7) means proxy mode is the
default, and a project is shareable the instant it exists, no separate trip to the
Share Links screen. `ProjectOverviewPage` surfaces it immediately with a one-click copy
button. This required breaking a circular import (`share_links.service` already imports
`projects.service` to validate a project exists) via a deferred import inside
`create_project` - documented inline, not hidden.

## Verification

`docs/tdr/0005`'s and `0006`'s pattern continues: the milestone's headline usability
metric ("signup -> first client link sent in under 10 minutes, unaided, with a real
non-teammate participant") requires an actual human test session and can't be satisfied
by automated or agent-driven testing by construction - not performed, flagged here as
outstanding rather than silently claimed. What *was* verified for real: a Python script
driving the full proxy stack against a genuine external site (`https://example.com` -
IANA's stable reserved test domain, not a mock) confirming the auto-created share link,
real server-side fetch, widget injection, and correct different-origin link handling;
and a real Playwright/Chromium session driving the *entire* guest journey - dashboard
project creation, the surfaced share link, a guest opening it, redirect to the real
proxied `example.com` page, the widget's name-prompt correctly skipped via the session
handoff, a real comment posted (with a real captured screenshot) through the proxy, and
the dashboard Board showing it.
