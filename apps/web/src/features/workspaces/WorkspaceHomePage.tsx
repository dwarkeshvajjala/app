import { Button } from "@backline/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";

import * as projectsApi from "../projects/api";
import type { WorkspaceOut } from "./api";

export function WorkspaceHomePage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [targetOrigin, setTargetOrigin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const projectsQueryKey = ["workspace", workspace.id, "projects"];
  const { data: projects, isLoading } = useQuery({
    queryKey: projectsQueryKey,
    queryFn: () => projectsApi.listProjects(workspace.id),
  });

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await projectsApi.createProject(workspace.id, name, targetOrigin);
      setName("");
      setTargetOrigin("");
      await queryClient.invalidateQueries({ queryKey: projectsQueryKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-xl font-semibold">{workspace.name}</h1>

      {isLoading && <p className="text-text-muted mt-4 text-sm">Loading projects...</p>}

      {projects && projects.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                to={`p/${project.id}`}
                className="hover:bg-bg-canvas flex items-center justify-between rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
              >
                <span className="font-medium">{project.name}</span>
                <span className="text-text-muted text-xs">{project.target_origin}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {projects && projects.length === 0 && (
        <p className="text-text-muted mt-6 text-sm">
          No projects yet - create one below to generate your first share link.
        </p>
      )}

      <form
        className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10"
        onSubmit={handleCreate}
      >
        <h2 className="text-sm font-medium">New project</h2>
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Site URL
          <input
            required
            type="url"
            placeholder="https://staging.client.com"
            value={targetOrigin}
            onChange={(event) => setTargetOrigin(event.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
        {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          Create project
        </Button>
      </form>
    </main>
  );
}
