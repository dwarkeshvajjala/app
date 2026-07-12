import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useParams } from "react-router-dom";

import type { WorkspaceOut } from "../workspaces/api";
import * as projectsApi from "./api";

export function ProjectOverviewPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { projectId } = useParams<{ projectId: string }>();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
  });

  if (isLoading) {
    return <p className="text-text-muted p-6 text-sm">Loading...</p>;
  }

  if (!project) {
    return <p className="text-recovery-orphaned p-6 text-sm">Project not found.</p>;
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link to={`/w/${workspace.slug}`} className="text-text-muted text-xs underline">
        Back to {workspace.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{project.name}</h1>
      <p className="text-text-muted text-sm">{project.target_origin}</p>

      <div className="mt-6 flex flex-col gap-2">
        <Link
          to={`/w/${workspace.slug}/p/${project.id}/board`}
          className="hover:bg-bg-canvas rounded-md border border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10"
        >
          Board
        </Link>
        <Link
          to={`/w/${workspace.slug}/p/${project.id}/share-links`}
          className="hover:bg-bg-canvas rounded-md border border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10"
        >
          Share links
        </Link>
      </div>
    </main>
  );
}
