# Missed Functionality Analysis
Based on the `backline-Final Draft.html` prototype, here is a breakdown of functional features we are currently missing in the React app (excluding UI and styling):

## 1. Browser & Environment Emulation
- **Browser Selection ("Capture As")**: Ability to select which browser environment (Chrome, Safari, Firefox, Edge, etc.) you are recording a comment as. The HTML prototype tracks this state and injects it into new comments.
- **Device Orientation & Framing**: Functionality to toggle between "Portrait" and "Landscape" orientations, and adjust the canvas size (zoom in/out buttons). 
- **Environment Metadata Capture**: Comments capture and store rich environment data, such as OS version (e.g. `macOS 14.5`), device type (`desktop`, `phone`), and viewport dimensions.

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
