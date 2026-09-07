Now let me read the TDR files (relevant to review auth, board URL state, realtime, recovery, proxy scope, notifications, launch readiness) to build the conflict list against the audit's "Correct method" text.

Ran 2 commands, read b7xwt8xvk.txt

Confirmed: package.json (i18next deps) and main.tsx → M-18. Now compiling the full report.

Backline M-00 Verification Report (verification-only, no code changes)
1. Baseline facts
git rev-parse HEAD   -> d8564c2069ff4bb66132aacd5fdd24cedc3c5fef
git branch -vv       -> * main d8564c2 [origin/main] feat: add workspace global search   (up to date with origin/main)

Important correction to the audit's own framing: git status --short reports ~330 files as  M (modified), but this is not ~330 files of real changes. core.autocrlf=true is set locally, so every tracked file shows as modified purely from CRLF/LF normalization noise (git diff on those files produces only the "LF will be replaced by CRLF" warning, no content diff). Running git diff --ignore-space-at-eol --ignore-cr-at-eol isolates the real change set:

57 tracked files with genuine content diffs (2,672 insertions / 472 deletions)
15 untracked new files/dirs

Any later chat should use this same --ignore-space-at-eol --ignore-cr-at-eol filter — the raw git status count is misleading and should not be used to estimate scope.

2. Hash verification — MATCH
Field	Audit claim	Recomputed	Result
SHA-256	27455b8ef30395a1724016da3ad70575c74b816da32037e3ce87e981e95afba4	27455b8ef30395a1724016da3ad70575c74b816da32037e3ce87e981e95afba4	✅ match
Size	571,683 bytes	571,683 bytes	✅ match
Lines	6,720	6,720	✅ match

docs/reference/backline-final-draft.html is the verified baseline. No re-derivation needed in future chats.

3. File → workstream table (real diffs only)

Classification is by module/path convention and cross-checked against the audit's own file references where it names them explicitly. It has not been verified by reading every diff's full body — treat as routing, not proof of correctness.

Frontend (apps/web)
File	Workstream
apps/web/package.json	M-18 (adds i18next, react-i18next)
apps/web/src/main.tsx	M-18 (import "./lib/i18n")
apps/web/src/App.tsx	M-11
apps/web/src/app/layout/DashboardSidebar.tsx	M-11
apps/web/src/app/layout/WorkspaceLayout.tsx	M-11
apps/web/src/app/router.tsx	M-11
apps/web/src/features/activity/ActivityPage.tsx	M-17
apps/web/src/features/assets/AssetReview.tsx	M-14
apps/web/src/features/assets/api.ts	M-14
apps/web/src/features/auth/AuthContext.tsx	M-05
apps/web/src/features/auth/LoginPage.tsx	M-05
apps/web/src/features/auth/api.ts	M-05
apps/web/src/features/board/CommentThreadPanel.tsx	M-15 (per TDR-0011, this file is the reply/thread UI)
apps/web/src/features/board/api.ts	M-15/M-16
apps/web/src/features/clients/ClientsPage.tsx	M-17
apps/web/src/features/dashboard/GlobalSearch.tsx	M-11 (per TDR-0013)
apps/web/src/features/integrations/IntegrationsPage.tsx	M-17
apps/web/src/features/notifications/NotificationBell.tsx	M-06/M-11
apps/web/src/features/projects/ProjectForm.tsx	M-12
apps/web/src/features/projects/ProjectOverviewPage.tsx	M-13
apps/web/src/features/projects/ProjectsPage.tsx	M-12
apps/web/src/features/projects/api.ts	M-12/M-13
apps/web/src/features/projects/footer/ProjectFooter.tsx	M-13
apps/web/src/features/projects/footer/VersionMenu.tsx	M-13
apps/web/src/features/projects/footer/ViewportMenu.tsx	M-14
apps/web/src/features/projects/panel/CommentsTab.tsx	M-15
apps/web/src/features/share-links/ShareLinksPage.tsx	M-02
apps/web/src/features/share-links/api.ts	M-02
apps/web/src/features/tickets/TicketsPage.tsx	M-16
apps/web/src/features/workspaces/BillingPage.tsx	M-22
apps/web/src/features/workspaces/MembersPage.tsx	M-17
apps/web/src/features/workspaces/SettingsPage.tsx	M-04
apps/web/src/features/workspaces/ShareProjectModal.tsx	M-02
apps/web/src/features/workspaces/WorkspacePickerPage.tsx	M-11
apps/web/src/styles/backline.css	M-19
Backend
File	Workstream
backend/app/modules/assets/service.py	M-14/M-08
backend/app/modules/auth/repository.py	M-05
backend/app/modules/auth/router.py	M-05
backend/app/modules/auth/schemas.py	M-05
backend/app/modules/auth/service.py	M-05
backend/app/modules/notifications/repository.py	M-06/M-07
backend/app/modules/notifications/schemas.py	M-06
backend/app/modules/notifications/service.py	M-06
backend/app/modules/pages/repository.py	M-13
backend/app/modules/pages/router.py	M-13
backend/app/modules/pages/schemas.py	M-13
backend/app/modules/pages/service.py	M-13
backend/app/modules/projects/router.py	M-04/M-13
backend/app/modules/projects/schemas.py	M-04
backend/app/modules/projects/service.py	M-04/M-13
backend/app/modules/share_links/repository.py	M-02
backend/app/modules/share_links/router.py	M-02
backend/app/modules/share_links/schemas.py	M-02
backend/app/modules/share_links/service.py	M-02
Docs / tooling
File	Workstream
docs/implementation/06-delivery.md	M-21
docs/implementation/07-html-parity-audit.md	M-21
pnpm-lock.yaml	M-21 (dependency bump — matches i18next addition)
Untracked (new) files
File	Workstream
apps/web/src/components/Toast.tsx	M-10
apps/web/src/features/auth/AccountModal.tsx	M-05 / M-11
apps/web/src/features/comments/MentionsInput.tsx	M-15
apps/web/src/features/projects/ProjectMenu.tsx	M-13
apps/web/src/features/projects/ProjectPagesModal.tsx	M-13
apps/web/src/features/workspaces/WorkspaceSwitcherPopover.tsx	M-11
apps/web/src/lib/ScrollToTop.tsx	M-11
apps/web/src/lib/date-format.ts	M-18
apps/web/src/lib/i18n.ts	M-18
apps/web/src/lib/use-click-outside.ts	M-10
apps/web/src/lib/use-document-title.ts	M-10 / M-11
apps/web/src/lib/use-focus-trap.ts	M-10
apps/web/src/lib/use-locale.ts	M-18
apps/web/src/lib/use-unsaved-changes.ts	M-10
apps/web/src/locales/en/translation.json, apps/web/src/locales/hi-IN/translation.json	M-18
docs/implementation/08-senior-code-review-audit.md, docs/implementation/audit-review-summary.md	M-00 (input evidence, not a deliverable)

Caveat: this table routes files by module convention per the audit's own scope descriptions; it does not certify that each file's content correctly implements its workstream's "Correct method" — that requires the diff-by-diff review the audit itself schedules under M-01 through M-21.

4. TDR/spec conflict list — where the audit's "Correct method" text needs reconciliation

Most of the audit's "Correct method" prescriptions in section 5 are already restatements of accepted TDRs (share-link auth = TDR-0002, anchor/snapshot hash sharing = TDR-0004, diff-vs-recovery separation = TDR-0007, proxy scope limits = TDR-0008, board filters in URL = TDR-0005) — no conflict there, they reinforce each other. The following are the real discrepancies a later coding agent must resolve in the TDR's favor, not the audit's:

Global search scope (M-11) vs TDR-0013.
The audit's M-11 "Correct method" asks for "per-kind grouping/ranking/pagination" on global search. TDR-0013 (accepted 2026-09-07, same day as this audit, backing the very recent d8564c2 feat: add workspace global search commit) explicitly scopes the current search to a bounded (≤50 results, per-kind caps) regex search with no ranking, no pagination, client contacts deliberately excluded, and no guest exposure — and says a provider-backed upgrade is future work. Do not treat missing ranking/pagination as a defect to silently fix; that would exceed TDR-0013's accepted scope. Any expansion needs its own TDR amendment.
Notification digest preferences (M-06) vs TDR-0009.
The audit's M-06 review evidence says "Digest reportedly ignores user preferences" and lists this among gaps to fix. TDR-0009 explicitly decided per-member instant/daily preference is deferred, not half-built — every member currently gets the identical daily digest by design, with no memberships preference field. Building "digest respects preference" without first adding the schema field + settings UI TDR-0009 describes would misrepresent the fix as a bug patch when it's really new scope requiring its own TDR note (or an explicit amendment to TDR-0009).
"Email digest to client" project setting (M-04) has no TDR at all.
TDR-0009's digest work covers member digests only. A client-facing digest toggle (from FD-AUD-018/prototype) is undecided territory — flag it under assumption #9-equivalent, don't implement it as if TDR-0009 already covers client recipients.
"Re-anchor comments after deployment" project setting (M-04) vs TDR-0007.
TDR-0007 describes recovery as running unconditionally per new revision (when a prior revision exists) — there is no accepted notion of a per-project on/off toggle for this pipeline. If M-04 implements this prototype-sourced setting as a literal enable/disable switch, it risks contradicting TDR-0007's tested "always attempts recovery, only a human reanchor resets a permanently-orphaned comment" model. This needs an explicit decision/TDR before implementation, not silent toggle-wiring.
Mention notifications (M-06/M-15) vs TDR-0009's deferral.
TDR-0009 explicitly deferred "mentioned in a reply" notifications because no mention parser/UI existed. The untracked apps/web/src/features/comments/MentionsInput.tsx shows this work has now started — that's consistent with the audit's M-15 requirement to build the "genuinely separate feature" TDR-0009 described (parser, stable member IDs, recipient dedup, notification emission), not a contradiction, but it means TDR-0009's "deferred" note is stale the moment mentions ship and should be marked superseded/amended once merged, per audit rule M-21 ("any architecture/product divergence gets a dated TDR").
Zustand stores under M-20 cleanup vs TDR-0005/TDR-0006.
The audit's M-20 (Server state and frontend state rule 2.2) warns against duplicating server truth in Zustand. connectionStore.ts and presenceStore.ts are not accidental sprawl — TDR-0006 created them deliberately as "the exact cross-component need TDR-0005 deferred" (WS connection status, page-scoped presence counts — genuinely ephemeral, not server-record state). A later cleanup pass must not delete/flatten these as violations; they're accepted architecture.
Ticket data model (M-16) vs TDR-0012.
TDR-0012 explicitly requires "extend comments rather than creating duplicate ticket records." Any M-16 ticket work (TicketsPage.tsx, 244-line diff) must be verified to still store tickets as comment-shaped documents with workflow metadata, not a new parallel tickets collection — the audit's own M-13 "Deploy/version history" caution ("avoid duplicating revision truth in a second incompatible model") is the same principle TDR-0012 states for tickets specifically; worth calling out since the audit's master workstream list doesn't cite TDR-0012 by number anywhere in section 5.
Widget guest comment-list / layer-toggle gap (TDR-0006) not referenced anywhere in the audit's M-15.
TDR-0006 records two still-open gaps: (a) the widget has never rendered a list of existing comments as pins (only creation), and (b) there's no WS event for a comment leaving the guest-visible layer (client → team). If M-15's "move/resize/reanchor" or M-02's "client board visibility" work assumes the widget already tracks/removes comments live, it will collide with these known, accepted gaps — they must be closed together, not assumed solved.
Source-of-truth precedence should add docs/implementation/00-index.md.
TDR-0012 states the Final Draft PRD/flow matrix at docs/implementation/00-index.md is "a dated amendment to specs 01–20" — i.e. spec-level authority for Final Draft scope, not merely implementation-status documentation. The audit's section 1 precedence order (TDR > spec > implementation > HTML) doesn't call this out; a later agent should read 00-index.md as tier-2 (spec-equivalent for Final Draft matters), not tier-3.

No other reviewed TDR text contradicts the audit's "Correct method" language — TDR-0001, 0003, 0010, 0011 are process/technical decisions the audit doesn't touch, and TDR-0002/0004/0005/0007/0008 are correctly restated by the audit as constraints to preserve.

5. What this report does not do

Per the requested scope (M-00 §5 + checklist steps 1–2 only), this pass did not: read the 57 real diffs line-by-line, run any tests/lint/build, verify the actual "Correct method" enforcement (e.g., whether share_links policy fields are actually read), or check the P0 workstreams (M-01 through M-05) for real vs. resolved status. That is the scope of subsequent chats (checklist step 3 onward) and should start from this table rather than re-running git status/hash verification from scratch.