import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthContext";
import { useWorkspaceContext } from "./useWorkspaceContext";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

// The dashboard chrome (sidebar + everything under it: project grid, members, billing,
// settings, usage, mcp) - deliberately NOT used for an open project's own routes
// (ProjectLayout), which need the full viewport for the canvas and have their own,
// much lighter header instead (see ProjectLayout.tsx's docblock for why).
export function WorkspaceLayout() {
  const { logout } = useAuth();
  const result = useWorkspaceContext();

  if (result.status === "loading") {
    return <p className="text-text-muted p-6 text-sm">Loading workspace...</p>;
  }
  if (result.status === "not-found") {
    return <Navigate to="/" replace />;
  }
  if (result.status === "error") {
    return <p className="text-recovery-orphaned p-6 text-sm">{result.message}</p>;
  }
  if (result.status === "switching") {
    return <p className="text-text-muted p-6 text-sm">Opening {result.workspace.name}...</p>;
  }

  const { workspace } = result;

  return (
    <div className="flex min-h-screen">
      <WorkspaceSidebar workspace={workspace} onSignOut={() => logout()} />
      <div className="min-w-0 flex-1 overflow-y-auto">
        <Outlet context={{ workspace }} />
      </div>
    </div>
  );
}
