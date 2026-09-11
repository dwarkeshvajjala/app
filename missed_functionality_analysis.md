# Missed Functionality Analysis
Based on the `backline-Final Draft.html` prototype, here is a breakdown of functional features we are currently missing in the React app (excluding UI and styling):

## 1. Browser & Environment Emulation
- ~~**Browser Selection ("Capture As")**~~ — **IMPLEMENTED** (2026-09-10, commit `e86227e`). `ProjectFooter.tsx` renders `BrowserMenu.tsx` (Chrome/Safari/Firefox/Edge + version), selection is persisted in the URL (`?browser=`), threaded into the review iframe via a `blBrowser` param, and the widget (`apps/widget/src/index.ts`) stamps it onto `comment.context` on the backend (`ContextIn` in `backend/app/modules/comments/schemas.py`: `browser`, `os`, `viewport`, `device_type`, `url`). Filterable via `commentBrowser()`/`FilterSortBar.tsx`. Two real gaps remain, not a rebuild:
  1. The full environment string ("Chrome 128 · macOS 14.5 · 1512px") isn't rendered on the comment row/detail — only a generic device-type icon (`CommentRow.tsx`). The reference HTML showed this inline; worth adding as a small display change.
  2. `apps/e2e/tests/journeys/journey-8-browser-selection.spec.ts` targets selectors that never matched the real markup (`.bl-project-footer` / `.bl-dropdown-pop[aria-label="Browser"]` vs actual `.bl-review-statusbar` / `.bl-review-popover`) — it has been a false-green (or erroring) test since it was written, so there's no working regression coverage for this feature.
  3. Not implemented, and probably shouldn't be as a P0: real cross-engine rendering. The dropdown (in both the reference prototype and the current app) only tags metadata + light cosmetic touches — it does not actually re-render the iframe in Safari's/Firefox's real engine. The reference prototype's own copy says as much ("Real cross-engine screenshots run on Backline's device grid") — that's a separate, much larger feature (see Phase 2 note below) than the dropdown itself.
- **Device Orientation & Framing**: Toggle between "Portrait"/"Landscape", zoom in/out — already implemented (`ProjectFooter.tsx`, `ViewportMenu.tsx`).
- **Environment Metadata Capture**: OS, device type, viewport dimensions — already implemented, see above (`ContextIn` schema).

## 2. Advanced Commenting Tools
- **Region / Shape Tool (`is-drawing`)**: The prototype supports an `is-drawing` state where the cursor turns into a crosshair (`cursor:crosshair`), allowing users to draw a shape or select an area for a comment rather than just pinning a single point.
- **Console & Network Capture**: Comments are designed to capture console errors and failed network calls alongside the visual screenshot.
- **Web App State Capture**: A mode for "Review behind a login, with state captured" meant for complex authenticated web apps.
- **Comment Re-anchoring**: A specific project setting to "Toggle re-anchoring" (allowing comments to move or re-anchor themselves if the layout shifts).

## 3. Bulk Actions & Exporting
- **AI / Smart Actions**: Options to "Summarise open comments", "Build task list", and "Find duplicates".
- **Exporting Tools**: Functionality to "Export comments", "Export activity", "Copy as a checklist", "Copy for the tracker", and "Send to the ticket board".
- **Comment Management**: Functionality to "Mark all read" and "Review flagged comments".

## 4. Advanced Project Settings
- **Capture Toggles**: Granular settings to toggle "Capture browser and device details" on or off for the project.
- **Guest / Link Toggles**: Settings to "Toggle link access", "Open the guest view", and "Toggle client board access".
- **Deploy History**: Ability to view a project's "Deploy history".
- **Duplicate Project**: An action to duplicate an existing project.

## 5. Notification & Tracking
- **Digest Toggle**: A setting to "Toggle digest" for notifications.
- **Status Indicators**: "Tell me when it ships" functionality.

## 6. Features Inspired by Vercel Toolbar (Reference Images)
- **User Preferences & Customization**: Granular settings such as "Always Activate", "Start Hidden", Notification routing (e.g. Replies & Mentions only), and Theme (System/Light/Dark).
- **Keyboard Shortcuts Configuration**: A dedicated UI to view and assign custom key bindings for common actions (e.g., hitting `C` to comment).
- **Deployment / Environment Switching**: The ability to view threads scoped to specific deployments (e.g., a "dev" environment branch vs production) directly within the overlay.
- **Rich Comment Input**: An advanced comment composer that includes attachments (e.g., screenshots/camera icon) and rich text formatting ("Aa" icon) before posting.
- **Floating Dock / Quick Tools Menu**: A centralized, collapsible toolbar dock providing quick access to:
  - Branch / deployment switching
  - Performance / Analytics insights (stopwatch icon)
  - Inspect Element / Crosshair tool (target icon)
  - Accessibility checker (person icon)
  - Interaction / Draft Mode toggles (switch icon)
- **Session Controls**: Options to disable the toolbar for the current session or entirely for a specific domain.
- **Mobile / QR Access**: A "Show QR Code" feature for quickly opening the deployment on a mobile device.
