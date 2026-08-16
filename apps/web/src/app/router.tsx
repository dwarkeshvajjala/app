import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";

import { AuthCallbackPage } from "../features/auth/AuthCallbackPage";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { BoardPage } from "../features/board/BoardPage";
import { ClickUpOAuthCallbackPage } from "../features/integrations/ClickUpOAuthCallbackPage";
import { IntegrationsPage } from "../features/integrations/IntegrationsPage";
import { ProjectOverviewPage } from "../features/projects/ProjectOverviewPage";
import { ReviewEntryPage } from "../features/review/ReviewEntryPage";
import { ShareLinksPage } from "../features/share-links/ShareLinksPage";
import { BillingPage } from "../features/workspaces/BillingPage";
import { McpServerPage } from "../features/workspaces/McpServerPage";
import { MembersPage } from "../features/workspaces/MembersPage";
import { ProjectTypePlaceholderPage } from "../features/workspaces/ProjectTypePlaceholderPage";
import { SettingsPage } from "../features/workspaces/SettingsPage";
import { UsagePage } from "../features/workspaces/UsagePage";
import { WorkspaceHomePage } from "../features/workspaces/WorkspaceHomePage";
import { WorkspacePickerPage } from "../features/workspaces/WorkspacePickerPage";
import { ImagePdfIcon, MobileIcon, WebAppIcon } from "./layout/sidebar-icons";
import { ProjectLayout } from "./layout/ProjectLayout";
import { WorkspaceLayout } from "./layout/WorkspaceLayout";

function RequireAuth() {
  const { status } = useAuth();

  if (status === "loading") {
    return <p className="text-text-muted p-6 text-sm">Loading...</p>;
  }
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

// Full route tree (05-Frontend-Architecture.md §5.2) fills in as later milestones
// add the board/page-detail screens.
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
  { path: "/integrations/clickup/callback", element: <ClickUpOAuthCallbackPage /> },
  // Guest reviewer entry - no dashboard chrome, no member auth (05-Frontend-Architecture.md §5.2).
  { path: "/review/:shareToken", element: <ReviewEntryPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/", element: <WorkspacePickerPage /> },
      {
        path: "/w/:workspaceSlug",
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <WorkspaceHomePage /> },
          {
            path: "apps",
            element: (
              <ProjectTypePlaceholderPage
                label="Web App"
                tagline="Add comments to your web applications."
                icon={WebAppIcon}
              />
            ),
          },
          {
            path: "mobile",
            element: (
              <ProjectTypePlaceholderPage
                label="Mobile"
                tagline="Add comments to your mobile applications."
                icon={MobileIcon}
              />
            ),
          },
          {
            path: "image-pdf",
            element: (
              <ProjectTypePlaceholderPage
                label="Image & PDF"
                tagline="Add comments to your PDF & image files."
                icon={ImagePdfIcon}
              />
            ),
          },
          { path: "usage", element: <UsagePage /> },
          { path: "mcp", element: <McpServerPage /> },
          { path: "members", element: <MembersPage /> },
          { path: "billing", element: <BillingPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "integrations", element: <IntegrationsPage /> },
        ],
      },
      {
        path: "/w/:workspaceSlug/p/:projectId",
        element: <ProjectLayout />,
        children: [
          { index: true, element: <ProjectOverviewPage /> },
          { path: "board", element: <BoardPage /> },
          { path: "share-links", element: <ShareLinksPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
