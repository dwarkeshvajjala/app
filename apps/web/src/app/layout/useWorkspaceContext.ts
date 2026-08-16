import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { useAuth } from "../../features/auth/AuthContext";
import * as workspacesApi from "../../features/workspaces/api";
import type { WorkspaceOut } from "../../features/workspaces/api";
import { qk } from "../../lib/query-keys";

type WorkspaceContextResult =
  | { status: "loading" }
  | { status: "not-found" }
  | { status: "error"; message: string }
  | { status: "switching"; workspace: WorkspaceOut }
  | { status: "ready"; workspace: WorkspaceOut };

// Shared by every layout that resolves :workspaceSlug into a workspace context and
// switches the active access token into that workspace (13-Authentication.md §13.3)
// before rendering children - both DashboardLayout (sidebar) and ProjectLayout (no
// sidebar) need this exact same resolution, just with different chrome around it.
export function useWorkspaceContext(): WorkspaceContextResult {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { workspaceId: activeWorkspaceId, switchWorkspace } = useAuth();
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

  if (isLoading) return { status: "loading" };
  if (!targetWorkspace) return { status: "not-found" };
  if (switchError) return { status: "error", message: switchError };
  if (needsSwitch) return { status: "switching", workspace: targetWorkspace };
  return { status: "ready", workspace: targetWorkspace };
}
