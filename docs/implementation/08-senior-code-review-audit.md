# Senior code review audit — implementation correctness, standards, optimization

Date: 2026-09-07. Scope: `docs/implementation/07-html-parity-audit.md` (FD-AUD-001..054, UX-AUD-001..084, LANG-AUD-001..009).
Method: read-only review. No code changed in this pass.
Repo: `F:\qa tool\app`, branch `main` (`d8564c2 feat: add workspace global search`).

> How to read each item: **Task point** = what the audit asked. **Claimed** = status in `07-html-parity-audit.md`.
> **Verdict / Rating (1-5)** = 5=production-ready, 4=minor cleanup, 3=needs rework, 2=unsafe/incomplete, 1=missing/wrong.
> **What was done wrong** = correctness/standards gap. **Better approach** = correct method.
> **Files to change** = smallest touched set. **Repo-wide** = `rg` to find the same smell elsewhere.

## 0. Branch / working-tree note (related branches)

- Only local branch is `main`; `origin/main` is at the same commit. No feature branches to review.
- Working tree is dirty (`git status`): ~200 modified files + 15 untracked files. The untracked files ARE the in-progress fix attempt for this audit:
  `Toast.tsx`, `AccountModal.tsx`, `features/comments/`, `ProjectMenu.tsx`, `ProjectPagesModal.tsx`,
  `WorkspaceSwitcherPopover.tsx`, `ScrollToTop.tsx`, `date-format.ts`, `i18n.ts`, `use-click-outside.ts`,
  `use-document-title.ts`, `use-focus-trap.ts`, `use-locale.ts`, `use-unsaved-changes.ts`, `locales/`.
- Verdict on that work: direction is right, wiring is not done. `Toast` provider exists but `useToast` is imported in 0 feature files;
  `use-focus-trap` exists but `Dialog.tsx` does not call it; `i18n` + `locales/en|hi-IN` exist but only ~7 screens call `t()` (~21 keys vs 500+ strings).
  Do not count these as done until wired + tested. Related branches affected: none — but every item below touches `main` only.

## 1. Overall ratings (systemic)

| Area | Rating | One-line reason |
|---|---|---|
| Frontend architecture / component splits | 2/5 | 4 god files (`widget/ui.ts` 755 lines, `CommentsTab.tsx` 591, `widget/index.ts` 557, `BoardPage.tsx` 574); `TicketsPage.tsx` holds 8 components in 1 file |
| Frontend state management | 3/5 | `qk` factory + URL filters exemplary in 3 pages, but ad-hoc `queryKey:[...]` everywhere, 3 hand-rolled `setQueryData` upserts, `BoardPage.view/openThreadId` not in URL, `GlobalSearch` no debounce |
| Design system / styling | 2/5 | 3 dialects in one tree: `backline.css` `bl-*` + Tailwind + `packages/ui`; dark mode only on Tailwind paths |
| Icons / dialogs / popovers | 2/5 | 2 good SVG libs + unicode/emoji litter (`▦↳☷◷♧⌕🔔×📎`); 1 native `<dialog>` vs 5 hand-rolled overlays |
| Accessibility | 2/5 | Focus trap exists but unused by `Dialog`; pointer-only pin drag + board drag with no keyboard path; `role=button` divs |
| Backend routing / layer boundaries | 3/5 | router→service→repo mostly kept, but raw `db.*` in services/digest, `changes:dict` mass-assignment in pages, `_private` cross-module imports, deferred circular imports |
| Backend auth / tenant isolation | 2/5 | OTP-only correct, but integrations routes skip `require_workspace_match`; share-link/project policies stored-never-enforced; guest can PATCH/DELETE pages; `revoke_session_family` no ownership check |
| Notifications / activity wiring | 2/5 | `notify_reply/mention/status` defined-never-called; `target_route=None` on the one path that is called; digest ignores prefs + leaks team-layer bodies |
| DB indexing | 2/5 | Hottest queries unindexed (`notifications.read_at`, `share_links.workspace_id`, `pages/revisions/recovery` ws-prefix, `family_id`, `events(ws,type,created)`); search is post-`$lookup` regex scan |
| DB schema modeling (joins vs extra cols) | 3/5 | Counts correctly NOT denormalized (keep it); but replies duplicate parent `anchor/context_json`, `assignee_id+assignee_ids` dual-write, schemaless `*_json` drift, no `deploys/versions` collections |
| Retention / cleanup / audit events | 1/5 | `hard_delete_project` + `delete_page` orphan Mongo+R2 (no `delete_object` anywhere); page/integration/asset deletes emit no events |
| i18n / localization | 1/5 | Infra ~5% adopted; hardcoded strings, 4 date systems, hardcoded weekdays, `as TranslationKeys` casts |
| `packages/types` / OpenAPI hygiene | 3/5 | Not hand-edited (good); but no CI drift gate; untyped CSV export poisons generation; string dates not `date-time` |

## 2. Frontend systemic findings (do these first — they fix dozens of UX-AUD items at once)

### FE-01 — Ad-hoc React Query keys bypass `qk` factory
- Task points: UX-AUD-079, FD-AUD-012/032/036.
- What was done wrong: `lib/query-keys.ts` says "never construct ad-hoc key arrays", but `AssetReview.tsx:24,26,30`, `CommentThreadPanel.tsx:63-75`, `ShareProjectModal.tsx:60`, `ProjectPagesModal.tsx:22,30`, `ProjectForm.tsx:55`, `CollaboratorsModal.tsx:75` all build `["..."]` inline. Invalidations miss (`AssetReview:30` invalidates without `guest` suffix).
- Better approach: extend `qk` with `assets, assetComments, shareLinks, projectPages, project`; codemod all call sites; eslint ban on `queryKey:[` outside `query-keys.ts`.
- Files to change: `apps/web/src/lib/query-keys.ts`, `AssetReview.tsx`, `CommentThreadPanel.tsx`, `ShareProjectModal.tsx`, `ProjectPagesModal.tsx`, `ProjectForm.tsx`, `CollaboratorsModal.tsx`, `ProjectCard.tsx`, `TicketsPage.tsx`.
- Repo-wide: `rg -n "queryKey:\s*\[" apps/web/src --glob '*.tsx'`

### FE-02 — Invalidation incoherent: `invalidate` vs `setQueryData` vs `refetch()` vs polling
- Task points: UX-AUD-079/081/082.
- What was done wrong: 3 copies of comment-upsert `setQueryData` (`BoardPage:132,153,172`, `ProjectOverviewPage:70,87`, `CommentThreadPanel:98,113`); `TicketsPage:38` invalidates whole workspace for one status flip; `AssetReview:24,27` polls every 10-30s alongside WS.
- Better approach: one `useUpsertProjectComment(projectId)` hook; narrow invalidates; drop `refetchInterval` where `useWSEvent` covers it.
- Files to change: `BoardPage.tsx`, `ProjectOverviewPage.tsx`, `CommentThreadPanel.tsx`, `TicketsPage.tsx`, `AssetReview.tsx`, `NotificationBell.tsx`.
- Repo-wide: `rg -n "invalidateQueries|setQueryData|\.refetch\(\)|refetchInterval" apps/web/src --glob '*.{ts,tsx}'`

### FE-03 — URL-filter contract half-kept
- Task points: FD-AUD-014/032/033, UX-AUD-013/034/057.
- What was done wrong: `TicketsPage`, `ProjectsPage`, `BoardPage` filters in URL (good), but `BoardPage.view/selected/openThreadId:67-69` stays in `useState`; `openThreadId` seeded once from `?comment=` never written back — deep-link/refresh/back broken.
- Better approach: move `view` (+ bidirectional `?comment=<id>`) into `searchParams` like `TicketsPage.display`; keep `selected:Set` local and document as ephemeral.
- Files to change: `apps/web/src/features/board/BoardPage.tsx`, `apps/web/src/features/tickets/TicketsPage.tsx`.
- Repo-wide: `rg -n "useSearchParams|useState.*view|useState.*selected|useState.*openThread|searchParams\.get" apps/web/src/features --glob '*.tsx'`

### FE-04 — God files: split before adding features
- Task points: FD-AUD-027/032/035, UX-AUD-047/056/060.
- What was done wrong: `TicketsPage.tsx:139-341` = 8 components (`TicketBoard, StatusSelect, TicketCalendar, NewTicket, PeoplePicker, TicketDetail, TicketDetailForm, DatePicker`); `CommentsTab.tsx:57-591` + `BoardPage.tsx:63-574` duplicate status domain; 2000-char `row()` JSX in `TicketsPage:71`.
- Better approach: `tickets/` → `TicketsPage, TicketFilters, TicketTable, TicketBoard, TicketCalendar, DatePicker, TicketDetail/*, PeoplePicker(shared)`; extract `CommentRow, CommentFilters, CommentSort`; memoize rows.
- Files to change: `TicketsPage.tsx`, `CommentsTab.tsx`, `BoardPage.tsx`, `lib/workflow.ts`, `packages/ui/src/Badge.tsx`.
- Repo-wide: `rg -n "^function (Ticket|StatusSelect|PeoplePicker|DatePicker|NewTicket)" apps/web/src/features/tickets/TicketsPage.tsx`; list files >400 lines before each slice.

### FE-05 — 5 status label/color sources of truth
- Task points: FD-AUD-014/032, UX-AUD-004/056.
- What was done wrong: `STATUS_META` (CommentsTab:15-45) vs `STATUSES` (BoardPage:31-39) vs `WORKFLOW_STATUSES` (workflow.ts:4-12) vs `Badge.tsx:43-55` vs `widget/index.ts:22-29`. Visible bug: `BoardPage` says `"To do"`, `workflow.ts` says `"Not started"` for `todo`.
- Better approach: single `workflow` + `StatusBadge/LayerBadge` from `@backline/ui` everywhere.
- Files to change: above 5 files + every consumer.
- Repo-wide: `rg -n "STATUS_LABELS|STATUS_COLORS|STATUS_META|WORKFLOW_STATUSES|STATUSES" apps/web/src packages/ui/src apps/widget/src --glob '*.{ts,tsx}'`

### FE-06 — Copy/date/search/validation/toast: 5 shared-hook extractions
- Task points: UX-AUD-020/021/023/026, FD-AUD-029/035, LANG-AUD-005.
- What was done wrong: 5 hand-rolled `navigator.clipboard.writeText` (`ShareLinksPage:67`, `ProjectForm:56`, `CollaboratorsModal:98`, `ProjectCard:58`, `ShareProjectModal:88`); 4 date systems (`date-format.ts` vs `time.ts` vs `CommentThreadPanel:13-20` vs 10× direct `toLocale*` + `UsagePage:5` pinned `en-US`); 6 copy-pasted search bars; `trim()` 30+×, email only `type=email`; `Toast.tsx` built but `useToast` used in 0 features while `alert()/confirm()` remain (`ClientsPage:37`, `McpTab:36`, `UpgradeToProModal:118`, `AccountModal:68`, `ProjectPagesModal:84`, `ProjectCard:90`).
- Better approach: `useCopyToClipboard()`, single `date-format.ts` (deprecate direct `toLocale*`), `<SearchInput>` + `useUrlFilters(keys)`, zod schemas + `<Field>` + `parseDomains()`, replace all `alert/confirm` with `Dialog` + `toast()`, lint-ban `alert|confirm`.
- Files to change: files listed above + `lib/time.ts`, `lib/date-format.ts`, `components/Toast.tsx`, `components/Dialog.tsx`.
- Repo-wide: `rg -n "navigator\.clipboard|writeText|setCopied" apps/web/src --glob '*.tsx'`; `rg -n "toLocale(Date|Time|String)|new Intl\.|formatDate|timeAgo" apps/web/src --glob '*.{ts,tsx}'`; `rg -n "useToast|toast\(|alert\(|confirm\(|window\.confirm" apps/web/src --glob '*.{ts,tsx}'`; `rg -n "required|maxLength|\.trim\(\)|aria-invalid" apps/web/src/features --glob '*.tsx'`

### FE-07 — Styling: 3 dialects, dark-mode half-shipped
- Task points: UX-AUD-001/003/006.
- What was done wrong: `backline.css` `bl-*` + Tailwind + `packages/ui` (`Button/Badge/Avatar`) in one tree; `index.css` import order fragile; `Button primary/secondary/danger` does not map to `bl-button/mint/quiet`; Tailwind `dark:` paths vs hard-coded light `bl-*` surfaces.
- Better approach: `backline.css` = tokens only, Tailwind = implementation, `packages/ui` = sole component API; codemod `bl-button→<Button>`, `bl-chip→<Badge>`; decide light-only (remove `dark:`) or full light/dark contract.
- Files to change: `apps/web/src/styles/backline.css`, `apps/web/src/index.css`, `packages/ui/src/*`, all `bl-button/bl-chip` consumers.
- Repo-wide: `rg -n "className=.*(bl-|dark:)|@apply|var\(--bl-" apps/web/src --glob '*.{tsx,css}'`

### FE-08 — Icons + dialogs: standardize primitives
- Task points: UX-AUD-002/028/029/030/031, FD-AUD-024.
- What was done wrong: good SVG libs (`panel/icons.tsx`, `layout/sidebar-icons.tsx` with `McpIcon`/`Chevron` duplicated) + raw glyphs (`▦↳☷◷♧⌕✓✕×←→📎⌘`) in `DashboardSidebar:21-25,45`, `GlobalSearch:101,115`, `Toast:91-94`, `Dialog:13`, `AssetReview:98-103`, `ProjectsPage:34,44`, `TicketsPage:221`; 1 native `<dialog>` (`Dialog.tsx:9`) vs 5 hand-rolled (`CommentThreadPanel:158`, `VersionMenu:68`, `DatePicker:286-338`, `GlobalSearch:118`, `WorkspaceSwitcherPopover:103`); `use-focus-trap.ts` exists but `Dialog.tsx` never calls it; Esc/outside/focus-restore done 4 ways.
- Better approach: single `packages/ui/icons`, lint-ban raw glyphs; single `<Modal>` (wrapping `<dialog>` + `useFocusTrap` + `useOnClickOutside` + Esc) and single `<Popover>`; migrate all call sites.
- Files to change: `panel/icons.tsx`, `layout/sidebar-icons.tsx`, `components/Dialog.tsx`, `lib/use-focus-trap.ts`, `lib/use-click-outside.ts` (+ new `useDismiss`), all overlay consumers.
- Repo-wide: `rg -n "[⌕✓✕×←→↳▦☷◷♧⌄＋⚠↻📎●⌘]" apps/web/src --glob '*.tsx'`; `rg -n "showModal|<dialog|role=\"dialog\"|bl-popover|fixed inset-0" apps/web/src --glob '*.tsx'`

### FE-09 — Widget split
- Task points: FD-AUD-029/030, UX-AUD-043/069/070.
- What was done wrong: `widget/src/ui.ts` 755 lines (styles string + tooltip/composer/thread/pins/toast) + `widget/src/index.ts` 557 lines (bootstrap+snapshot+WS+UI) + 3rd relative-time impl (`widget/time.ts:22`) + own `STATUS_LABELS`.
- Better approach: `widget/ui/{styles,composer,thread,pins,toast}.ts`, share workflow constants via `packages/types` or `packages/ui`.
- Files to change: `apps/widget/src/ui.ts`, `apps/widget/src/index.ts`, `apps/widget/src/time.ts`.
- Repo-wide: `rg -n "STATUS_LABELS|timeAgo|openComposer|openThreadView" apps/widget/src --glob '*.ts'`

## 3. Backend systemic findings

### BE-01 — Repository bypass + untyped mass-assignment
- Task points: FD-AUD-020/048/050/051.
- What was done wrong: raw `db.projects.find/aggregate`, `db.projects.update_one/delete_one` in `dashboard/service.py:46,75,93,96`, `projects/service.py:218,293`, `notifications/digest.py:23,26,57`; `pages/router.py:41-54` → `service.py:76-82` (`changes:dict`) → `repository.py:63-66` (`$set:patch`, no allow-list); dual `name/target_origin/changes` contract in `projects/router.py:59-67`; `auth/service.py:262-282` manual `preferences.*` prefixing.
- Better approach: move to `*Repository(workspace_id-first)`; pass `PageUpdate`/`ProjectUpdate` models through, service allow-lists `title/sort_order`; router passes model only.
- Files to change: `dashboard/service.py`, `projects/service.py`, `notifications/digest.py`, `pages/router|service|repository.py`, `projects/router.py`, `auth/router|service.py`.
- Repo-wide: `rg -n "db\.(projects|comments|memberships|users|pages)\.(find|aggregate|update_one|delete_one|count_documents)" backend/app/modules --glob '*service.py'`; `rg -n "changes: dict|model_dump\(exclude_unset" backend/app/modules/pages backend/app/modules/projects`

### BE-02 — Tenant isolation holes (highest severity)
- Task points: FD-AUD-039/040/041/042/053, UX-AUD-018.
- What was done wrong: (a) `integrations/router.py:18-36` skips `require_workspace_match` (token ws-A can hit ws-B URL). (b) Share-link/project policies write-only: `ask_reviewer_name/domain_restrictions/comment_export_permission` (`share_links/*:13-29,25-41,27-69`) and `reviewer_can_resolve/show_board_to_client` (`projects/schemas:74-85`) have zero reads; `create_guest_session:140-182` accepts empty name + any email; expiry `<` vs `actor_access.py:38` `<=`. (c) Guest can PATCH/DELETE pages (`pages/router.py:43-62` uses `get_current_actor` + `resolve_actor_project_access`). (d) `revoke_session_family` (`auth/service.py:254-259` + `router.py:118-124`) has "Optional: verify family belongs to user" comment — no ownership check. (e) No project ACL (`permissions.py:21-47` workspace roles only).
- Better approach: add `require_workspace_match` to every `/{workspace_id}/` route + parametrized cross-tenant test; central `check_share_policy()` + `check_project_policy()` called from guest-session, comment-mutation, board-list, export; gate page mutations with `require_permission("project:manage")`; `find family where family_id+user_id else 404`; explicit TDR for project ACL (add `project_collaborators` or remove requirement).
- Files to change: `integrations/router.py`, `share_links/service|router.py`, `projects/router.py`, `comments/service.py`, `dashboard/*board*`, `pages/router|service.py`, `auth/service|router.py`, `core/permissions.py`, `workspaces/service.py`, `core/actor_access.py`.
- Repo-wide: `rg -n "require_workspace_match|require_workspace_context" backend/app/modules/*/router.py`; `rg -n "domain_restrictions|ask_reviewer_name|comment_export_permission|reviewer_can_resolve|show_board_to_client" backend/app --glob '*.py'`; `rg -n "get_current_actor" backend/app/modules/pages/router.py`; `rg -n "revoke_family|family_id" backend/app/modules/auth`

### BE-03 — Untyped/stub export + no idempotency + 4 pagination dialects
- Task points: FD-AUD-022, UX-AUD-021/080, FD-AUD-053.
- What was done wrong: `projects/router.py:138-154` mid-file import, no `response_model`, `service.py:307-330` returns header-only CSV (fetch commented out), no `[@+=|-]` sanitization, no export-permission check; zero `Idempotency-Key` handling (only `pages/service.py:35-36` idempotent); offset/limit + cursor + capped-slice + unbounded `list[...]` coexist; `GET /pages/{id}/comments`, `/projects/{id}/comments` unbounded.
- Better approach: typed CSV response + `'`-prefix sanitization + permission check + streaming; `Idempotency-Key` header + `idempotency_keys{key,workspace_id,response_hash,expires}` (or `client_request_id` unique index) on POSTs; one cursor contract (`limit+cursor+has_more`) for comments/notifications/search, capped offset only for tickets/activity.
- Files to change: `projects/router|service.py`, all POST routers, `comments/router.py`, `notifications/router.py`, `dashboard/router|service.py`.
- Repo-wide: `rg -n -i "csv|Content-Disposition|formula" backend/app/modules`; `rg -n -i "idempotency|client_request_id" backend/app`; `rg -n "response_model=list\[|offset|before:.*datetime|each_limit" backend/app/modules/*/router.py`

### BE-04 — Notifications defined-never-called + digest leaks
- Task points: FD-AUD-006/038/049, UX-AUD-063.
- What was done wrong: `notify_comment_reply/mention/status_changed` (`notifications/service.py:80-164`) have zero call sites; sole caller (`comments/service.py:685`, `dashboard/service.py:254`) is `notify_comment_assigned` without `workspace_slug/project_id` → `target_route=None`; `share_link_created/deploy_recovery_completed` in schema never emitted; `digest.py:57-83` emails every member, ignores `daily_digest/notify_*` (`auth/schemas:21-26`), includes team-layer bodies in plaintext; ad-hoc `project.restored/settings_updated/duplicated/hard_deleted` literals (`projects/service.py:188,224,273,301`) vs `events.py` constants.
- Better approach: call reply/mention/status notifiers from `create_reply/update_comment` with real slug/project; emit or remove unused types; digest filters `layer=client` + per-recipient visibility + prefs; all event types as constants in `*/events.py`.
- Files to change: `notifications/service|schemas|digest.py`, `comments/service.py`, `dashboard/service.py`, `share_links/service.py`, `recovery_engine/service.py`, `projects|clients|assets/service.py`.
- Repo-wide: `rg -n "notify_comment_|notify_integration|target_route" backend/app/modules/comments/service.py backend/app/modules/dashboard/service.py backend/app/modules/notifications/service.py`; `rg -n "daily_digest|notify_on_|run_digest" backend/app/modules/notifications backend/app/modules/auth`; `rg -n "append_event" backend/app/modules/projects/service.py backend/app/modules/clients/service.py`

### BE-05 — Search correct-isolation, wrong-scale
- Task points: FD-AUD-005/049/051.
- What was done wrong (scale, not isolation — isolation is real: triple root filter + join re-check + `comment:view_team` gate): leading-wildcard regex cannot use btree; post-`$lookup` regex on `_project.name/_page.title` never indexed; `memberships.limit(200)` drops members 201+; `each_limit=min(limit,20)` + `items[:limit]` starves kinds; no ranking/pagination.
- Better approach: keep bounded regex for small ws; add `comments{workspace_id,text}` text/Atlas Search behind flag, keyset pagination, per-kind limits + explicit rank, `$lookup`-based member search (remove 200-cap).
- Files to change: `dashboard/service.py`, `dashboard/repository.py`, `dashboard/router.py`, `core/indexes.py`, `tdr/0013*`.
- Repo-wide: `rg -n "regex|root_pipeline|memberships.*limit\(200\)|each_limit" backend/app/modules/dashboard`; `rg -n "create_index" backend/app/core/indexes.py`

## 4. DB systemic findings (MongoDB)

### DB-01 — Add the 6 missing index compounds (additive, dry-run-first)
- Task points: FD-AUD-049/051, UX-AUD-080.
- What was done wrong: `count_unread/mark_all_read` filter `read_at` with only `(ws,user,created)` index (`indexes.py:80`, `notifications/repo:43-62`); `share_links` `project_id`-only (`indexes.py:42-43`, `repo:63-67` unscoped `find({project_id})`); `pages/revisions/diffs/recovery_logs` `page_id/comment_id`-first with no `workspace_id` (`indexes.py:48,50-51,73-74`); no `family_id/consumed_at` (`indexes.py:16-21`, `auth/repo:100-151`); `events` `(ws,created)+(type,created)` instead of `(ws,type,created,_id)` (`indexes.py:23-24`, `dashboard/repo:243-255` `type:^regex`); guest `last_seen` TTL never refreshed (`share_links/repo:83-104` no `touch()`).
- Better approach: additive `{(ws,user,read_at,created)}` (or partial `read_at:null`), `{(ws,project_id,created)}` + scope repo filter, `{(ws,project_id,url_normalized)}` + `{(ws,page_id,captured_at)}` + `{(ws,comment_id,created_at)}`, `{(family_id,revoked_at)}` + `{(user_id,family_id)}` + `{(email,consumed_at,expires_at)}`, `{(ws,type,created,_id)}`; `touch_last_seen` or document creation-based expiry. Keep old indexes until `explain()` comparison per `05-database.md:25`.
- Files to change: `backend/app/core/indexes.py`, `notifications/repository.py`, `share_links/repository.py`, `pages/repository.py`, `snapshot_engine/repository.py`, `recovery_engine/repository.py`, `auth/repository.py`, `dashboard/repository.py`.
- Repo-wide: `rg "create_index|expireAfterSeconds" backend/app/core/indexes.py`; `rg "count_unread|mark_all_read|read_at|family_id|last_seen_at|payload_json" backend/app`

### DB-02 — Joins vs extra columns: what to keep / remove / not add
- Task points: FD-AUD-036/045/046/047.
- What was done wrong: (a) Keep — `assignee_id+assignee_ids` dual-write (`comments/schemas:111-115`, `service:642-665`, `indexes:54,63-65`) is intentional compat per `05-database.md:15`; new code must read `assignee_ids` only, never add `assignee_names` (resolve via `users` join like `_resolve_author_name:104-123`). (b) Remove-on-migrate — replies duplicate parent `anchor+context_json` (`comments/service:295-316`, `assets/service:179-182`); store `parent_id` only. (c) Do-not-add — FD-AUD-036 client `open/resolved/reviewer/last_activity` must stay aggregations (`dashboard/repo:150-241`, `11-Database.md:206-212`), not new `clients.*_count` columns; `workspaces.branding_json:{}` (`repo:23`) stays empty; every `*_json` (`settings/payload/context/config`) needs a typed Pydantic sub-model before new flags go in.
- Better approach: stop writing anchor copies for new replies first, backfill reads with fallback; forbid count columns; type all `*_json`.
- Files to change: `comments/service|schemas.py`, `assets/service.py`, `workspaces/repository.py`, `projects/schemas.py`, `events.py` files.
- Repo-wide: `rg "assignee_id[^s]|assignee_ids" backend/app/modules/comments backend/app/core/indexes.py`; `rg "parent\[.anchor|context_json.*parent" backend/app/modules/comments backend/app/modules/assets`; `rg "_json|branding_json|settings_json|context_json|payload_json|config_json" backend/app/modules docs/spec/11-Database.md`

### DB-03 — Retention/cleanup is the P0 blocker
- Task points: FD-AUD-022/048/051.
- What was done wrong: `hard_delete_project` (`projects/service:292-293`) = single `delete_one(projects)`; `delete_page` (`pages/repo:68-69`, `service:98-113`) cascades nothing + emits no event; zero `delete_object` in repo (only `put_object` in `assets/service:98-104`); asset keys `assets/{ws}/{project}/{uuid}` + screenshots/attachments have no GC; `delete_page` breaks `list_comments_for_project` joins silently; destructive deletes violate `AGENTS.md` additive/dry-run-first rule; no `scripts/migrate*`/backfill runner.
- Better approach: disable hard-delete UI until dry-run-first cascade worker ships (counts per collection → backup → R2 delete → Mongo delete in dependency order → `project.hard_deleted` with counts); `delete_page` blocks when comments exist or soft-deletes + `page.deleted` event; tombstone + GC worker for R2; lint `delete_one/delete_many` without `workspace_id`.
- Files to change: `projects/service.py`, `pages/service|repository.py`, `assets/service.py`, `storage/*`, `memberships/repository.py:101-104`, new `backend/scripts/migrate_*.py` (dry-run-first).
- Repo-wide: `rg "hard_delete|repo\.delete|delete_one|delete_many|delete_object|put_object|assets/" backend/app/modules/{projects,pages,assets,storage}`; `rg "migration|backfill|dry.?run" backend/app docs/implementation AGENTS.md`

## 5. Per-audit-item verdicts (claimed → review)

Rating reminder: 5 done, 4 minor cleanup, 3 rework, 2 unsafe/incomplete, 1 missing.

### FD-AUD shell / nav / search / notifs (002-006)

| ID | Claimed | Verdict | What was wrong / better / files / repo-wide |
|---|---|---|---|
| FD-AUD-002 desktop gate | Partial/divergence | 3 — decision unrecorded | Wrong: responsive shipped but PRD still implies gate. Better: record keep-responsive in PRD + browser test <1024/>1024px. Files: `01-prd.md`, `WorkspaceLayout.tsx`. Repo-wide: `rg -n "1024|deskOnly|useMediaQuery" apps/web/src` |
| FD-AUD-003 ws switcher | Partial | 3 — new `WorkspaceSwitcherPopover.tsx` untracked+unwired | Wrong: rail links to `/`, popover not mounted in shell, no keyboard/outside/return-focus. Better: mount in `DashboardSidebar`, wire real switch-token flow, focus restore. Files: `DashboardSidebar.tsx`, `WorkspaceSwitcherPopover.tsx`, `WorkspacePickerPage.tsx`. Repo-wide: `rg -n "wsPop|WorkspaceSwitcher|/workspaces.*switch" apps/web/src backend/app/modules/workspaces` |
| FD-AUD-004 account button | Pending | 2 — new `AccountModal.tsx` untracked, uses `window.confirm` | Wrong: rail = name+signout only; modal not opened from shell. Better: open profile/notifs/security modal from `#meBtn`, replace `confirm` with `Dialog`. Files: `DashboardSidebar.tsx`, `AccountModal.tsx`, `components/Dialog.tsx`. Repo-wide: `rg -n "meBtn|AccountModal|window\.confirm" apps/web/src --glob '*.tsx'` |
| FD-AUD-005 global search | Partial | 3 — isolation right, scale/rank/route wrong | See BE-05 + FE `GlobalSearch` no-debounce (query-per-keystroke, `setActiveIndex` race). Better: debounce 200-300ms + `placeholderData`, keyset pagination, route placed comments to page/thread, per-kind limits. Files: `GlobalSearch.tsx`, `lib/query-keys.ts`, `dashboard/service|repo|router.py`. Repo-wide: `rg -n "qk\.search|activeQuery|\$regex|root_pipeline" apps/web/src backend/app/modules/dashboard` |
| FD-AUD-006 notif list | Partial | 2 — click-through dead | Wrong: `target_route=None` (BE-04), small type set. Better: populate slug/project on emit, add target metadata + route-on-click. Files: `NotificationBell.tsx`, `notifications/service.py`, `comments|dashboard/service.py`. Repo-wide: `rg -n "target_route|notify_comment_" backend/app/modules` |

### FD-AUD auth / account (007-011)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-007 password sign-in | Intentional divergence | 5 — correct | OTP+Google only (`auth/router:42-71`, `LoginPage.tsx`) matches DECIDED. Keep. |
| FD-AUD-008 signup/reset | Intentional divergence | 5 — correct | OTP-first-verify = account creation. Keep. Do not re-add passwords (see DB-02/BE-02). |
| FD-AUD-009 login usability | Partial | 3 | OTP `autocomplete/one-time-code`, paste, resend/expiry/countdown missing (UX-AUD-019). Files: `LoginPage.tsx`. Repo-wide: `rg -n "autocomplete|one-time-code|resend|expir" apps/web/src/features/auth` |
| FD-AUD-010 profile/prefs | Pending | 2 | Backend prefs exist (`auth/schemas:21-40`) but Settings page = ws-name only; avatar/preference persistence + `AccountModal` wiring missing. Files: `SettingsPage.tsx`, `AccountModal.tsx`, `auth/*`. Repo-wide: `rg -n "UserPreferences|avatar_url|daily_digest" backend/app apps/web/src` |
| FD-AUD-011 pwd/sessions/2FA | Pending/proto | 2 — passwords must stay out, sessions/2FA real gaps | Wrong: audit still lists password hash in FD-AUD-046 (re-add risk); `list_sessions` ObjectId/str + string-date drift (BE B6); `revoke_session_family` no ownership (BE-02); HTML QR must be real TOTP. Better: lock OTP-only TDR, `datetime` fields, ownership check, additive `totp_secret_encrypted/enrolled_at/recovery_codes_hash`. Files: `auth/service|router|schemas|repository.py`. Repo-wide: `rg -n -i "password|reset_token|totp|2fa|family_id" backend/app/modules/auth docs/implementation/07*` |

### FD-AUD dashboard / projects (012-017)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-012 waiting-on-you | Partial | 3 | `ProjectsPage` loads 3 reply-needed but ordering/project/page context differ; counts vs sidebar can drift (FE-01/02). Files: `ProjectsPage.tsx`, `dashboard/service.py`. |
| FD-AUD-013 types/coming-soon | Partial | 3 | Placeholder routes ok, but roadmap copy/dates/notify-action missing; `ComingSoonModal` static. Files: `ProjectTypePlaceholderPage.tsx`, `ComingSoonModal.tsx`. |
| FD-AUD-014 project filters | Partial | 3 | Type/client/archived/search/sort/display exist; Active/In-review/Blocked/Resolved + legend + popover parity missing; status source-of-truth ×5 (FE-05). Files: `ProjectsPage.tsx`, `lib/workflow.ts`, `Badge.tsx`. |
| FD-AUD-015 cards/previews | Partial | 3 | Generated initial vs real thumbnails; pins/people/deploy-badge/page counts/duplicate missing; no loading/failed/stale preview states (UX-AUD-036). Files: `ProjectCard.tsx`, `ProjectsPage.tsx`. |
| FD-AUD-016 3-step wizard | Partial | 3 | `ProjectForm.tsx` one-form; no step machine/back/completion/ask-name/guest-preview; file drop/per-file/retry missing (UX-AUD-024/037/038). Files: `ProjectForm.tsx`, `NewProjectModal.tsx`. |
| FD-AUD-017 file validation/SVG | Partial | 2 | UI+`storage/schemas:9-19` omit `image/svg+xml` so presign fails, yet `assets/service:48-52` sniffs `<svg` — inconsistent + unsanitized delivery. Better: sanitize-or-reject in both layers + CSP sandbox (BE F1). Files: `ProjectForm.tsx`, `AssetReview.tsx`, `assets/service.py`, `storage/schemas.py`. Repo-wide: `rg -n "svg" backend/app/modules/assets backend/app/modules/storage apps/web/src --glob '*.{py,tsx}'` |

### FD-AUD lifecycle (018-022) — mostly 1-2, highest backend priority

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-018 review settings | Pending P0 | 1 | `ProjectSettingsOut` = `proxy_mode/snippet_installed` only; 5 flags missing + zero enforcement in widget/guest/board/notifs. Needs schema+migration+enforcement (BE-02). Files: `projects/schemas|service.py`, `ProjectForm.tsx`, widget + guest + board + notif workers. |
| FD-AUD-019 menu actions | Partial P0 | 2 | Settings/archive ok; new `ProjectMenu.tsx` untracked; manage-pages/deploys/duplicate/export/delete + confirmations missing. Files: `ProjectMenu.tsx`, `projects/router|service.py`. |
| FD-AUD-020 page mgmt | Pending P1 | 1 — plus guest-mutation hole | Dashboard CRUD missing; guest PATCH/DELETE allowed (BE-02); `delete_page` no cascade/event; `sort_order/kind` drift (DB B3). Files: `pages/router|service|repo.py`, `ProjectPagesModal.tsx` (untracked). |
| FD-AUD-021 deploys/versions | Pending P1 | 1 | No `deploys/versions` collections; `VersionMenu` static paywall; no reanchor-run records. Needs additive `deploys{project,ws,revisions,reanchored,orphaned}`. Files: `VersionMenu.tsx`, `snapshot|revision|recovery_engine/*`, `dashboard/repo.py`. |
| FD-AUD-022 dup/delete/export | Pending P1 | 1 — delete unsafe to expose | `duplicate_project` no lineage/pages/comments copy; `hard_delete` orphans everything (DB-03); export header-only + untyped + injection-unsafe (BE-03). Gate UI until cascade worker ships. Files: `projects/service|router.py`. |

### FD-AUD canvas (023-026)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-023 proxy loading | Partial | 3 | Iframe exists; progress/race/fallback-strip/retry/check-URL/blank-diagnostics missing (UX-AUD-041). Files: proxy module + preview canvas. |
| FD-AUD-024 preview controls | Partial | 3 | Browse/Comment/new-tab/presets/share/version exist; browser/width/orient/zoom/reload/undo-redo missing or static. Files: `ViewportMenu.tsx`, `VersionMenu.tsx`. |
| FD-AUD-025 page nav/header | Pending | 1 | One canvas, no navigable page list/active/header/counts (UX-AUD-044). Needs `ProjectPagesModal` wiring + deep links. |
| FD-AUD-026 image/PDF controls | Partial | 3 | Render+nav ok; zoom/orient/download/asset-lifecycle/counts incomplete (UX-AUD-045/046). `AssetReview.tsx:44-91` pointer-only (FE a11y). Files: `AssetReview.tsx`. |

### FD-AUD comments / review (027-031)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-027 sidebar filters | Partial | 3 | Status/layer/page-only/newest-oldest/counts/attach ok; replies/status/tags/device/browser/assignee/compact/group/hide-resolved/count-chips missing (UX-AUD-047). Split `CommentsTab` (FE-04). Files: `CommentsTab.tsx`. |
| FD-AUD-028 metadata | Partial | 3 | Ticket/detail has status/priority/tags/assignees/waiting/due/replies/layer; thread-detail lacks same pickers + date Clear/Today + client perms. Files: `CommentsTab.tsx`, `CommentThreadPanel.tsx`, `DetailsTab.tsx`. |
| FD-AUD-029 composer/mention | Partial | 2 | Widget attach + asset text/region ok; dashboard tray/screenshots/member-reply attach/inline-@mention/validation/notifs/previews missing; phantom `comment_mention` type with no parser (DB B5). Files: widget `ui|index.ts`, `CommentThreadPanel.tsx`, `comments/service.py`, `notifications/service.py`. |
| FD-AUD-030 move/resize | Pending | 1 | No `PATCH /comments/{id}/anchor`, no handles/keyboard/clamp/conflict/audit (UX-AUD-053). Needs endpoint + validation + audit. Files: `comments/router|service|schemas.py`, `AssetReview.tsx`. |
| FD-AUD-031 undo/redo | Pending | 2 | No inverse-action history. Either server-safe inverses or explicit wont-do TDR. Files: new hook/service + docs. |

### FD-AUD tickets / board (032-035)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-032 view modes | Partial | 3 | List/board/table/calendar/group/replies/CSV exist; labels raw lowercase, IDs/page/pins/empties/ordering differ (UX-AUD-056). Split file (FE-04). Files: `TicketsPage.tsx`. |
| FD-AUD-033 filters/sort | Partial | 3 | Status/project/priority/tag/assignee/view/group/sort exist via URL (good); multi-assignee faces/tag-sort/clickable-cells/chips/due-order missing (UX-AUD-057). Files: `TicketsPage.tsx`. |
| FD-AUD-034 drag/drop | Pending | 1 | Selects only; calendar not draggable; no optimistic+rollback+audit; no keyboard alternative (UX-AUD-058, a11y). Files: `TicketsPage.tsx` `TicketBoard`. |
| FD-AUD-035 date picker/form | Partial | 3 | Due dates + team tickets exist; calendar Clear/Today/nav/inline/screenshots/tags/project-page select/validation missing (UX-AUD-059). `DatePicker:286-338` custom, no trap. Files: `TicketsPage.tsx`. |

### FD-AUD clients / activity (036-038)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-036 client table | Partial | 3 | List/contact/chips/create/edit/search/archive ok; open/resolved/reviewer/last-activity/total/summary/layout missing — must be aggregations, NOT new columns (DB-02). Files: `ClientsPage.tsx`, `dashboard/repo.py`. |
| FD-AUD-037 client menu | Pending | 2 | Only Edit/Archive; rename/invite/new-project/see-all/export/confirm missing (UX-AUD-062). Files: `ClientsPage.tsx`. |
| FD-AUD-038 activity | Partial | 3 | Feed+pagination+links ok; Everything/Mine/Clients/Deploys + Today/Yesterday/Earlier + icons/copy/deploy-events/destinations missing; needs `(ws,type,created)` index (DB-01) + event constants (BE-04). Files: `ActivityPage.tsx`, `dashboard/repo|service.py`, `events.py` files. |

### FD-AUD sharing / guest (039-042) — P0, mostly 1-2

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-039 project roles | Pending/divergence | 1 | Workspace-Member/Admin only; no `project_collaborators`, no `require_project_access`. Needs TDR: add ACL or remove requirement (BE-02). |
| FD-AUD-040 link controls | Partial | 2 | Active/copy/passcode/expiry/create/revoke exist; enable/disable, Never/7/30 selector, pwd toggle, domain, export toggle, regenerate, ask-name, `expiresAt` UI all missing; stored policies unenforced (BE-02). Files: `ShareProjectModal.tsx`, `ShareLinksPage.tsx`, `share_links/*`. |
| FD-AUD-041 guest preview | Partial | 2 | Resolve/name-gate/passcode/session/comments/replies/revoked-expired ok; open-guest-view/leave/ask-name-enforce/domain-enforce/consistent canvas missing. Files: `ReviewEntryPage.tsx`, `share_links/service.py`, widget. |
| FD-AUD-042 guest perms | Pending P0 | 1 | No server-enforced resolve/board/due-assignee-hide/export/domain checks — backend, not CSS hiding. See BE-02. |

### FD-AUD AI / billing (043-044)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-043 AI | Pending/divergence | 4 — correctly not faked | `AiTab` paywall correct; HTML `CREDITS`/heuristics must stay out. Real work = provider job/quota/privacy/persistence contracts only after approval. |
| FD-AUD-044 plans/checkout | Pending/divergence | 4 — correctly not faked | Static display correct; needs provider+webhook+entitlement+limits before any checkout UI. |

### FD-AUD backend / DB (045-051) — see BE/DB sections; summary ratings

| ID | Claimed | Verdict |
|---|---|---|
| FD-AUD-045 project schema | Pending P0 | 1 — 8 fields missing (capture/reanchor/resolve/board/digest/type-env/lineage/retention) |
| FD-AUD-046 user/security docs | Pending P0 | 3 — passwords correctly out; 2FA/avatar/digest/mention real gaps (DB B4) |
| FD-AUD-047 sharing docs | Pending P0 | 1 — `enabled/resolve-perm/lineage/domain-verified/export` missing + mutable `[]` defaults + unenforced (DB B2, BE-02) |
| FD-AUD-048 pages/deploys | Pending P1 | 1 — no deploys/versions/reanchor-runs; `sort_order/kind` drift; delete orphans (DB B3, DB-03) |
| FD-AUD-049 search/notif model | Partial P0 | 2 — search interim ok; mentions phantom, `target_route` dead, types unlisted in `11-Database.md` (BE-04/05, DB B5) |
| FD-AUD-050 asset/comment contracts | Partial P1 | 2 — SVG unsafe/inconsistent, no asset delete/reorder/meta, no move/resize, no mention payload, no dashboard upload (BE F1/F2, DB B6) |
| FD-AUD-051 indexes/retention | Pending P1 | 1 — 6 index gaps + R2 orphans + audit-event gaps + no migration tooling (DB-01/03) |

### FD-AUD quality (052-054)

| ID | Claimed | Verdict | Notes |
|---|---|---|---|
| FD-AUD-052 browser journeys | Pending P0 | 1 | 14 journeys unrun; gate on backend P0s first (auth/settings/search/share/lifecycle). |
| FD-AUD-053 negative/security | Pending P0 | 1 | Scoping-lint script missing at CI path (`test_workspace_scoping_lint.py:6` vs absent `backend/scripts/check_workspace_scoping.py`); CSV injection, domain bypass, layer leakage untested (BE-02/03). |
| FD-AUD-054 docs reconcile | Partial P1 | 3 | Flow matrix fuller than delivery ledger; rows lack exact status+evidence. Update per slice; never mark planned as delivered. Files: `02-flow-matrix.md`, `06-delivery.md`. |

### UX-AUD (001-084) — grouped verdicts (all read; systemic fixes in §2)

| Group | IDs | Rating | Fix via |
|---|---|---|---|
| Visual/token/icon/type/contrast/motion/theme/overflow | UX-001..007 | 2 | FE-07 + FE-08 + contrast/reduced-motion/theme TDR |
| Toast/titles/offline | UX-008..010 | 2 | Wire `Toast` (FE-06); `use-document-title` (untracked, wire it); connection indicator from `connectionStore` |
| Shell/nav/routes/keyboard/popovers/not-found | UX-011..018 | 2 | FE-03 + FE-08 + route skeletons/focus + error taxonomy |
| Forms/validation/pending/dirty/copy/upload/URL/date/retry | UX-019..027 | 2 | FE-06 (validation schema, idempotency BE-03, `use-unsaved-changes` untracked — wire it) |
| Dialogs/menus/overlay | UX-028..031 | 2 | FE-08 single Modal/Popover |
| Dashboard/cards/wizard/client/file/coming-soon | UX-032..040 | 3 | FE-04 + FE-05 + wizard state machine |
| Canvas/pages/assets | UX-041..046 | 2 | Page list + asset lifecycle (DB B3/B6) + keyboard canvas |
| Comments/threads/mentions/move/undo/visibility | UX-047..055 | 2 | FE-04 + mention parser (DB B5) + move/resize endpoint (FD-030) |
| Tickets/board/calendar/detail | UX-056..060 | 2 | FE-04 + drag/keyboard + accessible calendar |
| Clients/activity/members/integrations | UX-061..064 | 3 | Aggregations (DB-02) + event constants (BE-04); secret-masking/retry/dirty/provider-unconfigured states |
| Sharing/guest UX | UX-065..070 | 2 | BE-02 policy enforcement first, then UX copy/states |
| A11y landmarks/focus/live/names/keyboard/zoom/cognitive | UX-071..077 | 2 | FE-08 + live-region policy + keyboard-only journey + skip-link/one-h1 |
| Resilience/perf/prod UX | UX-078..084 | 2 | Skeletons, invalidation matrix (FE-02), windowing, resource cleanup, safe error boundaries + correlation IDs, telemetry without PII |

### LANG-AUD (001-009)

| ID | Rating | Notes |
|---|---|---|
| LANG-001..009 | 1 — foundation missing | `packages/i18n` absent; `locales/en|hi-IN` 21 keys vs 500+ strings; `as TranslationKeys` unsafe; dates bypass `i18n.language` (FE-06); hardcoded weekdays/plurals/concat/emoji; no locale pref/fallback TDR, no backend error codes, no widget locale chunks, no pseudo-locale/CI gate. Recommended order stands: extract EN + pref/fallback + formatters + error codes + widget plumbing → one full `hi-IN` pass → expansion → RTL (`dir=rtl`, logical CSS, bidi isolation). New `lib/i18n.ts` + `use-locale.ts` (localStorage unguarded — wrap `try/catch`) are starts, not done. Files: new `packages/i18n/*`, `lib/i18n.ts`, `lib/date-format.ts`, `lib/time.ts`, all feature strings. Repo-wide: `rg -n "useTranslation|TranslationKeys" apps/web/src --glob '*.tsx'`; `rg -n "placeholder=|aria-label=" apps/web/src/features --glob '*.tsx' \| wc -l` |

## 6. Suggested fix order (smallest leverage-first)

1. BE-02 tenant/policy holes + DB-03 delete gating (ship nothing else until safe).
2. DB-01 indexes (additive, `explain()` before/after) + BE-04 notification wiring (`target_route`, reply/mention/status calls, digest prefs).
3. FE-08 Modal/Popover/icons + wire `Toast`, `use-focus-trap`, `use-click-outside`, `use-document-title`, `use-unsaved-changes` (fixes most UX-AUD-008..031 at once).
4. FE-01/02 `qk` + invalidation + `GlobalSearch` debounce.
5. FE-04/05 split `Tickets/Comments/Board` + single `StatusBadge`.
6. FE-06 shared hooks (copy/date/search/validation) + kill `alert/confirm`.
7. Lifecycle: FD-018 settings + FD-020 pages + FD-021 deploys + FD-022 dup/delete/export-behind-cascade + BE-03 idempotency/pagination/CSV safety.
8. Canvas/comments/tickets/sharing parity + LANG foundation (EN extraction + pref/fallback + formatters + error codes) before any `hi-IN` expansion.
9. `export_openapi && git diff --exit-code packages/types/` CI gate + `delete_one`-without-`workspace_id` lint + `i18next-parser` raw-literal gate.

## 7. Acceptance for this review to be considered addressed

- Every P0/P1 row above has either a fix commit or an explicit wont-do TDR; `02-flow-matrix.md` + `06-delivery.md` updated per slice with file evidence.
- `rg` patterns in §2-4 return zero (or allow-listed) hits; `pnpm turbo run lint typecheck build`, `ruff check`, `mypy`, `pytest`, `check_workspace_scoping.py` recorded honestly per `AGENTS.md`.
- No `alert/confirm`, no ad-hoc `queryKey:[`, no direct `toLocale*`, no raw-glyph icons, no unenforced policy field, no hard-delete without cascade worker.
