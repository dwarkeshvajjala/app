# Product requirements — Final Draft

## Purpose and actors

Backline is an agency review workspace for live websites, image sets and PDF documents. Staff coordinate feedback across clients and projects; guests review through a scoped link. Owners/admins manage workspace members and integrations. Existing guest/member isolation and persistent website anchors remain requirements.

## Product areas

- Workspace shell: workspace switch/create, global search, notification bell, project/ticket/status/archive navigation, plan visibility and account controls.
- Projects: cards, compact cards, list and table; type, archive, client and text filters; activity/added/open-count/name sorting; real thread/page counts; attention panel; create, rename, configure, archive and restore.
- Creation: choose Website, Images or PDF; client selection or inline creation; website URL with staging/live detection and override; private file uploads for asset types; share link after successful creation. Web App and Mobile remain explicitly upcoming as in the source; no invented launch dates.
- Clients: contact details, project associations, counts, search, create/edit/archive; a client record itself grants no membership or guest access.
- Tickets: every root comment is a ticket; standalone tickets belong to a project without pretending to have a DOM anchor. Workspace views include everyone, assigned to me, needs reply, waiting on client, overdue; list/table/board/calendar; search, status/project/priority/tag/person filters, grouping, dates and export.
- Review: real website preview, viewport selection, navigation and comment modes, pin/region selection, threads and replies, multiple assignees, six tags, five primary workflow statuses, priorities and due dates; attachments and visibility layers; recovery information and manual reanchor.
- Activity: recent tenant-scoped facts from the existing event log, filterable by event type. Never replay the prototype's fabricated ACTS array.
- Sharing: actual random tokens, passcode/expiry/revoke and regeneration; scoped guest entry; view/comment/edit permissions and verified domain restrictions need genuine server enforcement before they can be offered.
- Account: real profile and notification preferences; existing Google OAuth/email OTP. Password/reset/2FA/session controls in the prototype are desired future security features, not proof of authentication implementation.
- Assist and billing: summary, dev task, duplicates, tagging, changelog and reply assist; plan/credit displays. Production provider work requires actual product/provider configuration; never decrement a local counter and call it billed AI, or show a successful checkout without payment verification.
- Dashboard viewport: retain the responsive signed-in dashboard and mobile navigation; do not add the Final Draft prototype's hard block below 1024px. Guest review remains responsive as well. See TDR-0020.

## Canonical workflow

| Draft | Canonical API | Meaning |
|---|---|---|
| new | todo | Not started |
| prog | in_progress | In progress |
| rev | in_review | In review |
| block | blocked | Blocked |
| done | resolved | Resolved |
| prior release only | wont_fix | Closed without a fix; retained for existing records |

Open excludes `resolved` and `wont_fix`. Closed tickets have no waiting-on participants. Priority is `low`, `medium`, `high`; tags are Bug, Copy, Design, Responsive, Content, Accessibility. Persist member IDs, not names. Multiple assignees use `assignee_ids`; legacy `assignee_id` remains a compatibility projection. PATCH distinguishes omission from explicit null/empty arrays so dates and assignments can be cleared.

## Required behavioral guarantees

All counts derive from persisted non-deleted root comments, and archive handling is consistent across cards and workspace ticket views. Filters survive refresh and links. A failed write retains the draft and explains the error. Date-only choices use one documented UTC boundary; no random seeded due dates. Archive is reversible and must not allow guests to continue reviewing an archived project. No sample user/client records are silently imported from the HTML.

## Prototype conflicts resolved

The rail says “2 / 3 projects” while the plan definition says one Free project; existing installations already exceed that number. Do not impose an arbitrary quota retroactively. Use the existing plan value and real usage until commercial limits are configured. Retain OTP/OAuth rather than the fake Google chooser and plaintext remembered passwords. Retain the server proxy rather than the prototype's public CORS proxy race. Browser selection labels cannot truthfully emulate a different rendering engine; report actual browser context. Third-party provider test stubs are only for tests.
