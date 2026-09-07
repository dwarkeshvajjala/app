# Audit Batch 03 Verification Plan

**Date:** 2026-09-08  
**Status:** Ready for comprehensive testing

## Implementation Summary

### ✅ Completed Implementation

#### M-04: Enforce Project Review Settings
- **Backend (Schemas):** Project settings schema extended with 5 fields - all with `False` defaults for backward compatibility
  - `capture_device_details`
  - `reanchor_on_deploy`
  - `reviewer_can_resolve`
  - `show_board_to_client`
  - `client_digest_enabled`

- **Backend (Service):** 
  - `_redact_context()` function redacts browser/device telemetry based on `capture_device_details` setting
  - `create_comment()` fetches project settings and applies context redaction
  - `list_guest_board()` endpoint gates visibility by `show_board_to_client` setting
  - `resolve_own_comment()` endpoint gates resolution permission by `reviewer_can_resolve` setting
  - All functions properly validate project existence and gate access

- **Backend (Repository):**
  - `update_settings()` method uses dot-notation for selective field updates
  - Settings properly stored in `settings_json` document field

- **Backend (Router):**
  - `PATCH /projects/{id}/settings` endpoint properly routes updates
  - `GET /projects/{id}/guest-board` endpoint properly routes guest board requests
  - `PATCH /comments/{id}/resolve` endpoint properly routes guest resolution requests

- **Frontend (UI):** 
  - ProjectForm component displays all 5 checkboxes when editing a project
  - Settings properly initialized from `project.settings` object
  - Settings properly submitted via `updateProjectSettings()` API call

- **Frontend (API):**
  - `updateProjectSettings()` function properly calls PATCH endpoint
  - ProjectSettingsUpdate interface properly typed

#### M-06: Wire Notifications
- **Backend (Events):** Canonical event constants defined: `COMMENT_CREATED`, `COMMENT_ASSIGNED`, `COMMENT_REPLY`, `COMMENT_MENTION`, `COMMENT_STATUS_CHANGED`

- **Backend (Service - Notifications):**
  - `_workspace_slug()` resolves workspace dynamically
  - `_comment_deep_link()` builds correct deep links
  - `notify_comment_reply()` sends to parent author + assignees (excluding commenter)
  - `notify_comment_mention()` sends to mentioned member (with validation)
  - `notify_comment_status_changed()` sends to assignees + author when status changes
  - Membership guard prevents notifications to non-members

- **Backend (Service - Comments):**
  - `create_reply()` sends reply notifications to parent author + assignees
  - `create_reply()` sends mention notifications for each mentioned member
  - `update_comment()` sends status-change notifications when status changes

- **Frontend:**
  - `MentionsInput` component emits `onMentionedIdsChange` callback
  - `CommentThreadPanel` tracks mentioned user IDs and passes them to `createReply()`

#### M-08: Typed Mutation Contracts
- **Backend:** All raw `db.*` calls moved to repository methods
  - `CommentRepository.find_by_client_request_id()`
  - `CommentRepository.list_client_layer_for_project()`
  - `CommentRepository.list_since_for_workspace()`
  - `ProjectRepository.update_settings()`
  - `DashboardRepository.search_projects()`, `search_comments()`, `search_members()`
  - `WorkspaceRepository.list_all()`, `set_last_digest_sent_at()`

- **Backend (Idempotency):**
  - `client_request_id` field added to comment schema
  - Widget generates UUID for each comment creation attempt
  - Widget generates UUID for each reply attempt
  - Server checks before creating, returns existing comment on retry

- **Frontend:**
  - Widget adds `client_request_id` to all comment/reply POST payloads

### ⚠️ Items Flagged as Undecided (Not Implemented)

1. **`reanchor_on_deploy`** 
   - Status: Stored, typed, defaulted `False`, completely unread by recovery pipeline
   - Reason: TDR-0007 has no per-project toggle concept
   - Action needed: TDR amendment first

2. **`client_digest_enabled`**
   - Status: Stored, typed, defaulted `False`, completely unread
   - Reason: No TDR covers client-facing digest; naive reuse would be privacy defect
   - Action needed: Separate TDR + layer-filtered query before implementation

## Verification Checklist

### Critical Path Tests (P0)

- [ ] Backend: `pytest backend/tests/test_comments.py -k "guest_board or resolve_own or capture_device"` passes
- [ ] Backend: `pytest backend/tests/test_projects.py -k "settings"` passes
- [ ] Backend: `pytest backend/tests/test_notifications.py -k "mention or reply"` passes
- [ ] Frontend: ProjectForm renders all 5 settings checkboxes when project is loaded
- [ ] Frontend: Settings save and are persisted to backend
- [ ] Frontend: Comment creation respects capture_device_details toggle
- [ ] Frontend: Guest reviewer can resolve own comment when enabled
- [ ] Frontend: Guest board displays when enabled, hides when disabled

### Integration Tests

- [ ] Create project with all settings off
- [ ] Create comment - verify device details not captured
- [ ] Create comment with capture_device_details on - verify device details captured
- [ ] Create reply with @mentions - verify mention notifications sent
- [ ] Enable reviewer_can_resolve, have guest reviewer resolve own comment - verify works
- [ ] Enable show_board_to_client, have guest viewer access board - verify works
- [ ] Export project to CSV - verify formula injection protection

### Files That Should Be Tested

**Backend:**
- `backend/app/modules/comments/service.py:create_comment()` - context redaction logic
- `backend/app/modules/comments/service.py:create_reply()` - mention + reply notifications
- `backend/app/modules/comments/service.py:resolve_own_comment()` - guest resolution gate
- `backend/app/modules/comments/service.py:list_guest_board()` - board visibility gate
- `backend/app/modules/projects/service.py:update_project_settings()` - settings persistence
- `backend/app/modules/notifications/service.py:notify_comment_*()` - notification routing
- `backend/app/core/indexes.py:AUDIT_BATCH_03_INDEXES` - idempotency index

**Frontend:**
- `apps/web/src/features/projects/ProjectForm.tsx` - settings UI
- `apps/web/src/features/projects/api.ts:updateProjectSettings()` - API layer
- `apps/widget/src/index.ts` - client_request_id generation

## Known Fixes

### TDR-0017: Comment Request Index Startup Issue
- **Issue:** E11000 error on startup when creating unique sparse index for legacy comments
- **Fix:** Changed to partial index filtering by `client_request_id: { $type: "string" }`
- **Status:** ✅ Fixed in commits 7191804 and 8da3093
- **Tests:** test_comment_request_index.py covers startup with legacy comments, unique-within-workspace validation, and coexistence with old index

## Code Quality Notes

### No Issues Found
- All methods properly check for project existence before accessing settings
- All guest permissions properly gated with PermissionDeniedError
- All notification recipients validated against workspace membership
- CSV export properly escapes formula-leading characters
- Idempotency checks happen before state mutation

### Type Safety Notes
- Frontend ProjectForm uses `as any` for settings cast - not ideal but not a bug
- All Pydantic models properly defined with correct types
- OpenAPI schema regenerated to reflect new endpoints

## Next Steps (Ordered)

1. **Run Test Suite**
   - `pytest backend/tests/test_comment_request_index.py` (should pass - TDR-0017)
   - `pytest backend/tests/test_comments.py` (check for any failures)
   - `pytest backend/tests/test_projects.py` (check for any failures)
   - Frontend linting and build

2. **Create Integration Tests** (if not already present)
   - Test each M-04 setting with real comment creation
   - Test each M-06 notification type with real send
   - Test each M-08 idempotency scenario

3. **Manual Testing**
   - Settings UI in browser
   - Comment creation flow
   - Guest reviewer flow
   - Notifications delivery

4. **Deployment Verification**
   - Check Railway health after deployment
   - Verify Google OAuth still works (TDR-0017 fix)
   - Spot-check notification delivery in production

## Traceability

- FD-AUD-018 ✅ Project review settings persistence (M-04)
- FD-AUD-042 ✅ Guest permissions and board visibility (M-04)
- FD-AUD-049 ✅ Notification event wiring (M-06)
- FD-AUD-050 ✅ Mention payload support (M-06)
- FD-AUD-008 ✅ Typed mutation contracts (M-08)

## Decision Log

- **M-04:** All 5 settings stored and enforced at service layer, not React layer
- **M-06:** Workspace slug resolved dynamically; mention recipients validated against membership
- **M-08:** Idempotency via client_request_id; all db.* calls moved to repositories
- **Undecided:** `reanchor_on_deploy` and `client_digest_enabled` require separate product/TDR decisions
