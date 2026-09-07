# TDR-0015: Guest self-resolve amendment, and two project settings left undecided

Date: 2026-09-07
Status: Accepted (self-resolve amendment); reanchor toggle and client digest remain
open product decisions, not implemented

## Context

FD-AUD-018's persisted project review settings backlog names five prototype toggles.
Four had a typed `ProjectSettingsOut`/`ProjectSettingsUpdate` field already (added in
an earlier batch); none had real enforcement. Audit batch 01 (M-01/M-02) reviewed
`reviewer_can_resolve` and `show_board_to_client` and deliberately left both
unenforced, flagging `reviewer_can_resolve` as a direct conflict with
`13-Authentication.md` §13.5's permission matrix, which states "Change comment
status/assignee: **No (never)**" for guests as an unconditional constant, not
something a project setting can vary. This batch (M-04) was asked to enforce
`capture_device_details`, `reviewer_can_resolve`, and `show_board_to_client`
server-side. The first and third have no spec conflict. The second does, and per
section 6 rule 9 of the integration audit ("file a TDR where appropriate") and rule
M-21 ("any architecture/product divergence gets a dated TDR"), that conflict is
resolved here rather than silently patched around.

## Decision: `reviewer_can_resolve` - a narrow, additive amendment to §13.5

§13.5's guest permission matrix is amended from an unconditional "never" for comment
status changes to: **never, except moving a guest's own comment to `resolved`, and
only when the owning project's `reviewer_can_resolve` setting is enabled.** This is
implemented as its own endpoint, `PATCH /comments/{id}/resolve`
(`comment_service.resolve_own_comment`), deliberately separate from the member-only
moderation `PATCH /comments/{id}`, so that endpoint's contract never has to accept a
guest actor at all. The new endpoint is scoped on every axis:

- Guest actors only - a member already has the moderation PATCH for this.
- The comment's own author only (`_require_own_comment`, the same check
  delete/edit-own-comment already use).
- Gated by `project.settings_json.reviewer_can_resolve` - off by default
  (`ProjectSettingsOut`'s existing additive-backfill default), so no existing project
  gains this behavior without an explicit owner/admin opt-in.
- One direction only: → `resolved`. A guest can never reopen a comment, reassign it,
  edit any other field, or resolve a comment they didn't author, through this route.
- Idempotent: resolving an already-resolved comment is a no-op, not an error.

Every other guest write path is unchanged: guests still cannot set priority, tags,
assignees, due dates, or move a comment to any other status.

## Decision: "Re-anchor comments after a deployment" - not wired as a toggle

The prototype's setting text ("Keeps pins attached when markup changes") describes
exactly what `docs/tdr/0007`'s recovery pipeline already does unconditionally for
every project on every new revision - TDR-0007 has no per-project on/off concept, and
its accepted design explicitly treats recovery as normal per-revision behavior, not
an opt-in. Wiring `reanchor_on_deploy` to gate `run_recovery_pipeline` would mean: (a)
turning it off silently stops comments from following markup changes with no visible
product signal beyond a settings toggle, and (b) deciding what "off" even means for a
comment that already has `recovery_status: low_confidence`/`orphaned` from a prior
run - TDR-0007 has no answer for that either. This needs a product decision and a
superseding/amending TDR before any code reads this field, per the master audit's own
explicit instruction. The field remains stored (typed, defaulted `False`) and
completely unread by the recovery pipeline, exactly as batch 01 left it.

## Decision: "Email digest to the client" - not implemented

No TDR covers a client-facing digest at all. `docs/tdr/0009` describes only the
member daily digest (`notifications/digest.py`), which is workspace-member-scoped
end to end - `MembershipRepository.list_for_workspace`, no guest/client email path
anywhere in it. Naively adding client recipients to that same digest query would be a
real privacy defect: `CommentRepository.list_since_for_workspace` (M-08) is
explicitly documented as including both layers because every current recipient is a
workspace member entitled to see both - a guest recipient is not, and would need a
`layer == "client"` filter and a client-safe rendering the current digest was never
built for. `client_digest_enabled` remains stored, typed, defaulted `False`, and
unread, with this reasoning recorded so a future implementer does not reuse
`list_since_for_workspace` verbatim for a client-facing send.

## Consequences

`reviewer_can_resolve` is the only one of the three settings this TDR touches that
gains real enforcement. `reanchor_on_deploy` and `client_digest_enabled` remain
honest no-ops - stored, visible in the settings UI as inert until a decision is made,
never silently activated. Any implementation of either needs its own TDR amendment
before code reads the field, per this document's reasoning.
