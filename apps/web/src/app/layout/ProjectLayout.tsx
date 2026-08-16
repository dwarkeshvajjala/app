import { Navigate, Outlet } from "react-router-dom";

import { useWorkspaceContext } from "./useWorkspaceContext";

// An open project (the review canvas, its board, its share-links) is its own focused
// view, not a dashboard screen - the workspace's left sidebar has no reason to eat
// screen width here, and ruttl's own URL structure treats a project as a sibling route
// tree to the dashboard rather than a page nested under it. Each project-scoped page
// (ProjectOverviewPage, BoardPage, ShareLinksPage) still renders its own light header
// with a "Back" link to the dashboard.
export function ProjectLayout() {
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

  return <Outlet context={{ workspace: result.workspace }} />;
}
