# Frontend implementation plan

## Structure and routing

Keep React Router and existing workspace/project layouts. Add `features/tickets`, `features/clients` and `features/activity` with typed API functions; shared workflow labels belong in `lib`. Routes under `/w/:workspaceSlug`: `/tickets`, `/clients`, `/activity`; existing project overview/board/share-links and guest `/review/:shareToken` stay stable. Assigned/status/archive navigation uses query parameters rather than duplicate pages.

Replace the old product-type rail with Projects, Assigned to me, All tickets, Activity, Clients, workflow statuses and Archived; retain reachable member/settings/integration/billing routes. Use real workspace identity, notifications and membership data. The project grid gains type/client/archive filters, view controls and persisted metadata. Creation takes a typed request and handles client/environment choices without copying prototype arrays.

## Design mapping

Use the draft's paper `#F1F2F0`, white surface, ink `#0B0B0B`, line `#DDDEDA`, mint `#69DEB2`, amber `#E8B833`, Schibsted Grotesk and JetBrains Mono; 3px corner radius, 264px rail, restrained borders, compact uppercase mono labels. Keep legible contrast (mint uses dark text). Share status labels/colors rather than duplicating them across board, tickets, review and widget.

## Data and state

Generate all transport types from Pydantic/OpenAPI. React Query owns projects/clients/tickets/activity; URL parameters own filters, sorting, grouping and view. Local state owns open dialogs and unsaved drafts. Central query keys include workspace and complete filter values. Mutation success invalidates affected summaries/lists; comment realtime events refresh workspace aggregates and merge existing project caches. No localStorage records masquerade as persisted server data.

## Interaction requirements

List/table have editable status, date, priority, tags and multiple assignees. Board uses the same query and status mutation; calendar supports month navigation and shows unscheduled tickets. Ticket details reuse threaded comments with explicit project/page links. Search/filter/pagination errors are visible. Submit buttons disable during submission; failed writes keep form values. Modals use native dialog semantics, Escape, focus containment and focus return. Loading, empty, filtered-empty and error states are distinct.

## Review changes

Keep website proxy/snippet and the widget's anchor engine. Add asset review as its own project-type path; no pretend HTML anchors for image/PDF regions. Preserve member versus guest routes and team-layer filtering. Cross-engine browser emulation, checkout and AI success states require working backend capabilities first.

## Checks

Typecheck/lint/build all workspaces. Browser-test workspace → client → project → ticket → status/date/assignees → reload → archive/restore; compare with source visually. Re-run existing pin/attachment/recovery and guest-privacy journeys when modifying those paths. Never count a mocked browser journey as real backend verification.
