import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/query-keys";
import type { ProjectOut } from "./api";
import * as api from "./api";
import { Dialog } from "../../components/Dialog";
import { useToast } from "../../components/Toast";
import { useOnClickOutside } from "../../lib/use-click-outside";

export function ProjectMenu({ project, workspaceSlug, onManagePages }: { project: ProjectOut; workspaceSlug: string; onManagePages: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const { toast } = useToast();
  const [showHardDelete, setShowHardDelete] = useState(false);

  useOnClickOutside(menuRef, () => setOpen(false));

  const duplicate = useMutation({
    mutationFn: () => api.duplicateProject(project.id),
    onSuccess: async (newProject) => {
      await cache.invalidateQueries({ queryKey: qk.workspace(project.workspace_id) });
      navigate(`/w/${workspaceSlug}/p/${newProject.id}`);
      setOpen(false);
      setConfirmDuplicate(false);
      toast("Project duplicated without comments or history.");
    },
  });

  const exportComments = useMutation({
    mutationFn: () => api.exportProject(project.id),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}-comments.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast("Comment export downloaded.");
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
        <div role="menu" className="absolute right-0 top-full mt-1 w-56 rounded-md bg-bg-surface py-1 shadow-lg border border-black/10 dark:border-white/10 z-50">
          <button role="menuitem" onClick={() => { setOpen(false); onManagePages(); }} className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
            Manage pages
          </button>
          <button
            role="menuitem"
            onClick={() => { setConfirmDuplicate(true); setOpen(false); }}
            disabled={duplicate.isPending}
            className="w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
          >
            {duplicate.isPending ? "Duplicating..." : "Duplicate project"}
          </button>
          
          <button
            role="menuitem"
            className="block w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-50"
            disabled={exportComments.isPending}
            onClick={() => exportComments.mutate()}
          >
            {exportComments.isPending ? "Preparing export…" : "Export comments (CSV)"}
          </button>

          <button
            onClick={() => { setConfirmArchive(true); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Archive project
          </button>

          <button
            onClick={() => { setShowHardDelete(true); setOpen(false); }}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete forever
          </button>
        </div>
      )}

      {confirmDuplicate && (
        <Dialog title="Duplicate project?" onClose={() => setConfirmDuplicate(false)}>
          <div className="bl-form">
            <p><strong>{project.name}</strong> will be copied with its metadata, review settings, and website page list. Comments, revision/recovery history, share-link tokens, uploaded assets, and integrations stay with the original.</p>
            {duplicate.error && <p role="alert" className="bl-error">{duplicate.error.message}</p>}
            <div className="bl-form-actions"><button type="button" className="bl-quiet" onClick={() => setConfirmDuplicate(false)}>Cancel</button><button type="button" className="bl-button" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>{duplicate.isPending ? "Duplicating…" : "Duplicate project"}</button></div>
          </div>
        </Dialog>
      )}

      {exportComments.error && <p role="alert" className="bl-error">{exportComments.error.message}</p>}

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

      {showHardDelete && (
        <HardDeleteDialog
          project={project}
          onClose={() => setShowHardDelete(false)}
          onDeleted={() => {
            setShowHardDelete(false);
            navigate(`/w/${workspaceSlug}`);
          }}
        />
      )}
    </div>
  );
}

// M-03/FD-AUD-022: two-step preview-then-confirm, matching deletion_service.py's
// contract exactly - a correlation id from preview must be replayed into confirm,
// and confirm 409s server-side unless the project is already archived (deliberately;
// see docs/tdr/0014-dry-run-project-deletion-and-object-gc.md). This dialog only makes
// the server's own gate legible, it doesn't relax it.
function HardDeleteDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectOut;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typedName, setTypedName] = useState("");

  const preview = useQuery({
    queryKey: qk.hardDeletePreview(project.id),
    queryFn: () => api.previewHardDeleteProject(project.id),
  });

  const confirm = useMutation({
    mutationFn: () =>
      api.confirmHardDeleteProject(project.id, {
        correlation_id: preview.data!.correlation_id,
        project_name: typedName,
      }),
    onSuccess: onDeleted,
  });

  const isArchived = preview.data?.archived ?? false;
  const nameMatches = typedName.trim() === project.name;

  return (
    <Dialog title="Delete project forever" onClose={onClose}>
      <div className="p-4 w-[480px] max-w-full">
        {preview.isLoading && <p className="text-sm text-text-muted">Checking what would be deleted...</p>}
        {preview.isError && (
          <p role="alert" className="text-sm text-red-700">
            {preview.error instanceof Error ? preview.error.message : "Could not prepare this deletion."}
          </p>
        )}

        {preview.data && !isArchived && (
          <p className="text-sm text-text-muted">
            Archive <strong>{project.name}</strong> first - permanent deletion is only available for
            already-archived projects.
          </p>
        )}

        {preview.data && isArchived && (
          <>
            <p className="text-sm mb-3">
              This permanently deletes <strong>{project.name}</strong> and everything in it. This cannot be undone.
            </p>
            <ul className="text-xs text-text-muted mb-3 grid grid-cols-2 gap-x-4 gap-y-1">
              <li>Pages: {preview.data.counts.pages}</li>
              <li>Comments: {preview.data.counts.comments}</li>
              <li>Assets: {preview.data.counts.project_assets}</li>
              <li>Revisions: {preview.data.counts.revisions}</li>
              <li>Share links: {preview.data.counts.share_links}</li>
              <li>Notifications: {preview.data.counts.notifications}</li>
            </ul>
            <p className="text-xs text-text-muted mb-3">{preview.data.retention_notice}</p>

            {confirm.isError && (
              <p role="alert" className="mb-3 text-sm text-red-700">
                {confirm.error instanceof Error ? confirm.error.message : "Could not delete this project."}
              </p>
            )}

            <label className="block text-xs text-text-muted mb-3">
              Type <strong>{project.name}</strong> to confirm
              <input
                type="text"
                className="bl-input mt-1 w-full"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                autoFocus
              />
            </label>
          </>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" className="bl-quiet" onClick={onClose}>
            Cancel
          </button>
          {preview.data && isArchived && (
            <button
              type="button"
              className="bl-button bg-red-600 hover:bg-red-700 border-transparent text-white disabled:opacity-50"
              disabled={!nameMatches || confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? "Deleting..." : "Delete forever"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
