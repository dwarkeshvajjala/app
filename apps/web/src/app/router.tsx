import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router-dom";

import { AuthCallbackPage } from "../features/auth/AuthCallbackPage";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
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
// add projects/share-links/board/pages screens.
const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/auth/callback", element: <AuthCallbackPage /> },
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
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
