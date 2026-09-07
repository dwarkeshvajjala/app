import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { useWSEvent } from "../WSProvider";

import { useAuth } from "../../features/auth/AuthContext";
import { qk } from "../../lib/query-keys";
import { useWorkspaceContext } from "./useWorkspaceContext";
import { DashboardSidebar } from "./DashboardSidebar";
import { GlobalSearch } from "../../features/dashboard/GlobalSearch";
import { NotificationBell } from "../../features/notifications/NotificationBell";

// The dashboard chrome (sidebar + everything under it: project grid, members, billing,
// settings, usage, mcp) - deliberately NOT used for an open project's own routes
// (ProjectLayout), which need the full viewport for the canvas and have their own,
// much lighter header instead (see ProjectLayout.tsx's docblock for why).
export function WorkspaceLayout() {
  const { logout } = useAuth();
  const result = useWorkspaceContext();
  const cache = useQueryClient();
  const workspaceId = "workspace" in result ? result.workspace.id : undefined;
  const refresh = useCallback(() => {
    if (workspaceId) void cache.invalidateQueries({ queryKey: qk.workspace(workspaceId) });
  }, [cache, workspaceId]);
  useWSEvent("comment.created", refresh);
  useWSEvent("comment.updated", refresh);
  useWSEvent("comment.deleted", refresh);

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
    <div className="bl-app">
      <DashboardSidebar workspace={workspace} onSignOut={() => logout()} />
      <div className="bl-main">
        <header className="bl-topbar"><GlobalSearch workspaceId={workspace.id} workspaceSlug={workspace.slug} /><NotificationBell /></header>
        <Outlet context={{ workspace }} />
      </div>
    </div>
  );
}
