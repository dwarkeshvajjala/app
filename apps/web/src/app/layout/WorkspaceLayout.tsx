import { useCallback, useState } from "react";
import { Avatar } from "@backline/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { useWSEvent } from "../WSProvider";

import { qk } from "../../lib/query-keys";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useWorkspaceContext } from "./useWorkspaceContext";
import { DashboardSidebar } from "./DashboardSidebar";
import { AccountModal } from "../../features/auth/AccountModal";
import { useAuth } from "../../features/auth/AuthContext";
import { GlobalSearch } from "../../features/dashboard/GlobalSearch";
import { NotificationBell } from "../../features/notifications/NotificationBell";
import { useConnectionStore } from "../../stores/connectionStore";

// Account entry point - top-right of the persistent topbar, next to search and
// notifications, rather than a text button buried at the bottom of the sidebar
// (where the eye has to travel past the whole nav to find it every time).
function AccountButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="bl-account-btn" aria-label="Your account" onClick={() => setOpen(true)}>
        <Avatar name={user?.name ?? "?"} avatarUrl={user?.avatar_url} size={32} />
      </button>
      {open && <AccountModal onClose={() => setOpen(false)} />}
    </>
  );
}

// The dashboard chrome (sidebar + everything under it: project grid, members, billing,
// settings, usage, mcp) - deliberately NOT used for an open project's own routes
// (ProjectLayout), which need the full viewport for the canvas and have their own,
// much lighter header instead (see ProjectLayout.tsx's docblock for why).
export function WorkspaceLayout() {
  const result = useWorkspaceContext();
  const cache = useQueryClient();
  const workspaceId = "workspace" in result ? result.workspace.id : undefined;
  const refresh = useCallback(() => {
    if (workspaceId) void cache.invalidateQueries({ queryKey: qk.workspace(workspaceId) });
  }, [cache, workspaceId]);
  useWSEvent("comment.created", refresh);
  useWSEvent("comment.updated", refresh);
  useWSEvent("comment.deleted", refresh);

  const connStatus = useConnectionStore((s) => s.status);

  if (result.status === "loading") {
    return <LoadingScreen />;
  }
  if (result.status === "not-found") {
    return <Navigate to="/" replace />;
  }
  if (result.status === "error") {
    return <p className="text-recovery-orphaned p-6 text-sm">{result.message}</p>;
  }
  if (result.status === "switching") {
    return <LoadingScreen label={`Opening ${result.workspace.name}`} />;
  }

  const { workspace } = result;

  return (
    <div className="bl-app">
      <DashboardSidebar workspace={workspace} />
      <div className="bl-main">
        <header className="bl-topbar"><GlobalSearch workspaceId={workspace.id} workspaceSlug={workspace.slug} /><NotificationBell /><AccountButton /></header>
        {connStatus !== "connected" && (
          <div
            className={`bl-conn-banner ${connStatus === "reconnecting" ? "reconnecting" : "offline"}`}
            aria-live="polite"
            role="status"
          >
            {connStatus === "reconnecting"
              ? "Reconnecting to Backline…"
              : "You are offline. Changes may not be saved."}
          </div>
        )}
        <Outlet context={{ workspace }} />
      </div>
    </div>
  );
}
