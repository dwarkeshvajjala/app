import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { qk } from "../../lib/query-keys";
import * as projectsApi from "../projects/api";
import type { ProjectOut } from "../projects/api";
import { NewProjectModal } from "./NewProjectModal";
import { NewProjectMenu } from "./NewProjectMenu";
import { ProjectCard } from "./ProjectCard";
import { ShareProjectModal } from "./ShareProjectModal";
import * as workspacesApi from "./api";
import type { WorkspaceOut } from "./api";

type SortOrder = "updated" | "added";

export function WorkspaceHomePage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const queryClient = useQueryClient();

  const [showNewProject, setShowNewProject] = useState(false);
  const [shareTarget, setShareTarget] = useState<ProjectOut | null>(null);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("updated");

  const projectsQueryKey = ["workspace", workspace.id, "projects"];
  const { data: projects, isLoading } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => projectsApi.listProjects(workspace.id),
  });

  const { data: members } = useQuery({
    queryKey: qk.members(workspace.id),
    queryFn: () => workspacesApi.listMembers(workspace.id),
  });
  const memberByUserId = useMemo(
    () => new Map((members ?? []).map((member) => [member.user_id, member])),
    [members],
  );

  const visibleProjects = useMemo(() => {
    const filtered = (projects ?? []).filter((p) =>
      p.name.toLowerCase().includes(search.trim().toLowerCase()),
    );
    return filtered
      .slice()
      .sort((a, b) =>
        sortOrder === "updated"
          ? b.updated_at.localeCompare(a.updated_at)
          : b.created_at.localeCompare(a.created_at),
      );
  }, [projects, search, sortOrder]);

  async function handleCreate(name: string, targetOrigin: string) {
    await projectsApi.createProject(workspace.id, name, targetOrigin);
    await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    setShowNewProject(false);
  }

  return (
    <main className="px-6 py-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" className="text-text-muted shrink-0">
            <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" strokeWidth="1.3" />
            <path d="m12 12 2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search projects..."
            aria-label="Search projects"
            className="text-text-primary min-w-0 border-none bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
          <div className="ml-2 flex shrink-0 items-center gap-1 text-sm">
            <button
              onClick={() => setSortOrder("updated")}
              aria-pressed={sortOrder === "updated"}
              className={`rounded-md px-2.5 py-1 font-medium ${
                sortOrder === "updated" ? "bg-accent-primary/10 text-accent-primary" : "text-text-muted"
              }`}
            >
              Last updated
            </button>
            <button
              onClick={() => setSortOrder("added")}
              aria-pressed={sortOrder === "added"}
              className={`rounded-md px-2.5 py-1 font-medium ${
                sortOrder === "added" ? "bg-accent-primary/10 text-accent-primary" : "text-text-muted"
              }`}
            >
              Last added
            </button>
          </div>
        </div>
        <NewProjectMenu onCreateWebsite={() => setShowNewProject(true)} />
      </div>

      {isLoading && <p className="text-text-muted mt-6 text-sm">Loading projects...</p>}

      {visibleProjects.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              workspaceSlug={workspace.slug}
              project={project}
              creator={project.created_by ? memberByUserId.get(project.created_by) : undefined}
              onShare={setShareTarget}
            />
          ))}
        </div>
      )}

      {projects && projects.length === 0 && (
        <p className="text-text-muted mt-6 text-sm">
          No projects yet - create one to generate your first client review link.
        </p>
      )}

      {projects && projects.length > 0 && visibleProjects.length === 0 && (
        <p className="text-text-muted mt-6 text-sm">No projects match "{search}".</p>
      )}

      {showNewProject && (
        <NewProjectModal onCreate={handleCreate} onClose={() => setShowNewProject(false)} />
      )}

      {shareTarget && (
        <ShareProjectModal
          project={shareTarget}
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          onClose={() => setShareTarget(null)}
        />
      )}
    </main>
  );
}
