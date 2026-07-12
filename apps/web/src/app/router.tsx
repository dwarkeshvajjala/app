import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";

import { AuthCallbackPage } from "../features/auth/AuthCallbackPage";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { BoardPage } from "../features/board/BoardPage";
import { ProjectOverviewPage } from "../features/projects/ProjectOverviewPage";
import { ReviewEntryPage } from "../features/review/ReviewEntryPage";
import { ShareLinksPage } from "../features/share-links/ShareLinksPage";
import { MembersPage } from "../features/workspaces/MembersPage";
import { WorkspaceHomePage } from "../features/workspaces/WorkspaceHomePage";
import { WorkspacePickerPage } from "../features/workspaces/WorkspacePickerPage";
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
          { path: "members", element: <MembersPage /> },
          { path: "p/:projectId", element: <ProjectOverviewPage /> },
          { path: "p/:projectId/board", element: <BoardPage /> },
          { path: "p/:projectId/share-links", element: <ShareLinksPage /> },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
