import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/query-keys";
import type { ProjectOut } from "./api";
import * as api from "./api";
import { Dialog } from "../../components/Dialog";
import { API_BASE_URL } from "../../lib/api-client";
import { useOnClickOutside } from "../../lib/use-click-outside";

export function ProjectMenu({ project, workspaceSlug }: { project: ProjectOut; workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);

  useOnClickOutside(menuRef, () => setOpen(false));

  const duplicate = useMutation({
    mutationFn: () => api.duplicateProject(project.id),
    onSuccess: async (newProject) => {
      await cache.invalidateQueries({ queryKey: qk.workspace(project.workspace_id) });
      navigate(`/w/${workspaceSlug}/p/${newProject.id}`);
      setOpen(false);
    },
  });

  const archive = useMutation({
    mutationFn: () => api.archiveProject(project.id),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: qk.workspace(project.workspace_id) });
      navigate(`/w/${workspaceSlug}`);
    },
  });

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary rounded-md border border-black/10 dark:border-white/10"
      >
        Options ▼
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-md bg-bg-surface py-1 shadow-lg border border-black/10 dark:border-white/10 z-50">
          <button
            onClick={() => { duplicate.mutate(); }}
            disabled={duplicate.isPending}
            className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {duplicate.isPending ? "Duplicating..." : "Duplicate project"}
          </button>
          
          {/* File export relies on standard browser navigation so we don't use apiFetch for it, as it handles download headers better */}
          <a
            href={`${API_BASE_URL}/api/v1/projects/${project.id}/export`}
            className="block w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5"
            download
            onClick={() => setOpen(false)}
          >
            Export comments (CSV)
          </a>

          <button
            onClick={() => { setConfirmArchive(true); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Archive project
          </button>
        </div>
      )}

      {confirmArchive && (
        <Dialog title="Archive project" onClose={() => setConfirmArchive(false)}>
          <div className="p-4">
            <p className="mb-4">Archive <strong>{project.name}</strong>? Review links will stop working, and you can restore the project later.</p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="bl-quiet"
                onClick={() => setConfirmArchive(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="bl-button bg-red-600 hover:bg-red-700 border-transparent text-white"
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
              >
                {archive.isPending ? "Archiving..." : "Archive project"}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
