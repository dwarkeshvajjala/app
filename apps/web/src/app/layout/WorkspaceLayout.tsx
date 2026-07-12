import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useParams } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthContext";
import * as workspacesApi from "../../features/workspaces/api";
import { qk } from "../../lib/query-keys";

// Resolves :workspaceSlug into a workspace context, and switches the active access
// token into that workspace (13-Authentication.md §13.3) before rendering children -
// nothing under here ever renders with a token scoped to the wrong workspace.
export function WorkspaceLayout() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { workspaceId: activeWorkspaceId, switchWorkspace, logout } = useAuth();
  const [switchError, setSwitchError] = useState<string | null>(null);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: qk.workspaces(),
    queryFn: workspacesApi.listWorkspaces,
  });

  const targetWorkspace = workspaces?.find((w) => w.slug === workspaceSlug);
  const needsSwitch = targetWorkspace && targetWorkspace.id !== activeWorkspaceId;

  useEffect(() => {
    if (!targetWorkspace || !needsSwitch) return;
    switchWorkspace(targetWorkspace.id).catch((err: unknown) => {
      setSwitchError(err instanceof Error ? err.message : "Could not open this workspace.");
    });
  }, [targetWorkspace, needsSwitch, switchWorkspace]);

  if (isLoading) {
    return <p className="text-text-muted p-6 text-sm">Loading workspace...</p>;
  }

  if (!targetWorkspace) {
    return <Navigate to="/" replace />;
  }

  if (switchError) {
    return <p className="text-recovery-orphaned p-6 text-sm">{switchError}</p>;
  }

  if (needsSwitch) {
    return <p className="text-text-muted p-6 text-sm">Opening {targetWorkspace.name}...</p>;
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div className="flex items-center gap-6">
          <Link to={`/w/${workspaceSlug}`} className="font-semibold">
            {targetWorkspace.name}
          </Link>
          <Link to={`/w/${workspaceSlug}/members`} className="text-text-muted text-sm">
            Members
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-text-muted text-xs underline">
            Switch workspace
          </Link>
          <button className="text-text-muted text-xs underline" onClick={() => logout()}>
            Sign out
          </button>
        </div>
      </header>
      <Outlet context={{ workspace: targetWorkspace }} />
    </div>
  );
}
