import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "../../lib/query-keys";
import type { ProjectOut } from "./api";
import * as api from "./api";
import { listShareLinks } from "../share-links/api";
import { Dialog } from "../../components/Dialog";
import { useToast } from "../../components/Toast";
import { useOnClickOutside } from "../../lib/use-click-outside";

function reviewUrl(token: string): string {
  return `${window.location.origin}/review/${token}`;
}

// Share/Settings/Manage-pages stay parent-driven (callback props) because each
// caller already owns that UI: ProjectOverviewPage has its own dedicated Share and
// Pages buttons beside this menu, ProjectsPage's dashboard card doesn't. Everything
// else here (rename, copy link, duplicate, export, archive/restore, hard-delete) is
// self-contained so both callers get it for free.
export function ProjectMenu({
  project,
  workspaceSlug,
  onManagePages,
  onShare,
  onSettings,
}: {
  project: ProjectOut;
  workspaceSlug: string;
  onManagePages?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const cache = useQueryClient();
  const { toast } = useToast();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [showHardDelete, setShowHardDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(project.name);

  useOnClickOutside(menuRef, () => setOpen(false));

  function refreshWorkspace() {
    return cache.invalidateQueries({ queryKey: qk.workspace(project.workspace_id) });
  }

  const rename = useMutation({
    mutationFn: () => api.updateProject(project.id, { name: renameValue.trim() }),
    onSuccess: async () => { await refreshWorkspace(); setRenaming(false); toast("Project renamed."); },
  });

  const copyLink = useMutation({
    mutationFn: () => listShareLinks(project.id),
    onSuccess: (links) => {
      const active = links.find((l) => !l.revoked_at);
      if (!active) { toast("No active share link yet — use Share to create one."); return; }
      void navigator.clipboard.writeText(reviewUrl(active.token)).then(() => toast("Review link copied."));
    },
  });

  const duplicate = useMutation({
    mutationFn: () => api.duplicateProject(project.id),
    onSuccess: async (newProject) => {
      await refreshWorkspace();
      setConfirmDuplicate(false);
      toast("Project duplicated without comments or history.");
      navigate(`/w/${workspaceSlug}/p/${newProject.id}`);
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
    },
  });

  const archive = useMutation({
    mutationFn: () => api.archiveProject(project.id),
    onSuccess: async () => { await refreshWorkspace(); setConfirmArchive(false); toast("Project archived."); },
  });

  const restore = useMutation({
    mutationFn: () => api.restoreProject(project.id),
    onSuccess: async () => { await refreshWorkspace(); setConfirmRestore(false); toast("Project restored."); },
  });

  function item(label: string, onClick: () => void, opts: { danger?: boolean; disabled?: boolean } = {}) {
    return (
      <button
        type="button"
        role="menuitem"
        className={`bl-dropdown-item${opts.danger ? " danger" : ""}`}
        disabled={opts.disabled}
        onClick={onClick}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="bl-dropdown" ref={menuRef} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      <button
        type="button"
        className="bl-dropdown-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Project options"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && (
        <div role="menu" className="bl-dropdown-pop">
          {onShare && !project.archived_at && item("Share…", () => { setOpen(false); onShare(); })}
          {!project.archived_at && item(copyLink.isPending ? "Copying…" : "Copy review link", () => { setOpen(false); copyLink.mutate(); }, { disabled: copyLink.isPending })}
          {onSettings && !project.archived_at && item("Settings", () => { setOpen(false); onSettings(); })}
          {onManagePages && item("Manage pages", () => { setOpen(false); onManagePages(); })}
          {item("Rename", () => { setRenameValue(project.name); setRenaming(true); setOpen(false); })}
          {item(duplicate.isPending ? "Duplicating…" : "Duplicate project", () => { setConfirmDuplicate(true); setOpen(false); }, { disabled: duplicate.isPending })}
          {item(exportComments.isPending ? "Preparing export…" : "Export comments (CSV)", () => { setOpen(false); exportComments.mutate(); }, { disabled: exportComments.isPending })}
          <div className="bl-dropdown-sep" role="separator" />
          {project.archived_at
            ? item("Restore project", () => { setConfirmRestore(true); setOpen(false); })
            : item("Archive project", () => { setConfirmArchive(true); setOpen(false); }, { danger: true })}
          {item("Delete forever", () => { setShowHardDelete(true); setOpen(false); }, { danger: true })}
        </div>
      )}

      {renaming && (
        <Dialog title="Rename project" onClose={() => setRenaming(false)}>
          <form className="bl-form" onSubmit={(e) => { e.preventDefault(); rename.mutate(); }}>
            <label>Project name<input className="bl-input" autoFocus maxLength={200} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} /></label>
            {rename.error && <p role="alert" className="bl-error">{rename.error.message}</p>}
            <div className="bl-form-actions"><button type="button" className="bl-quiet" onClick={() => setRenaming(false)}>Cancel</button><button className="bl-button" disabled={rename.isPending || !renameValue.trim()}>{rename.isPending ? "Saving…" : "Save"}</button></div>
          </form>
        </Dialog>
      )}

      {exportComments.error && <p role="alert" className="bl-error">{exportComments.error.message}</p>}

      {confirmDuplicate && (
        <Dialog title="Duplicate project?" onClose={() => setConfirmDuplicate(false)}>
          <div className="bl-form">
            <p><strong>{project.name}</strong> will be copied with its metadata, review settings, and website page list. Comments, revision/recovery history, share-link tokens, uploaded assets, and integrations stay with the original.</p>
            {duplicate.error && <p role="alert" className="bl-error">{duplicate.error.message}</p>}
            <div className="bl-form-actions"><button type="button" className="bl-quiet" onClick={() => setConfirmDuplicate(false)}>Cancel</button><button type="button" className="bl-button" disabled={duplicate.isPending} onClick={() => duplicate.mutate()}>{duplicate.isPending ? "Duplicating…" : "Duplicate project"}</button></div>
          </div>
        </Dialog>
      )}

      {confirmArchive && (
        <Dialog title="Archive project" onClose={() => setConfirmArchive(false)}>
          <div className="bl-form">
            <p>Archive <strong>{project.name}</strong>? Review links will stop working, and you can restore the project later.</p>
            {archive.error && <p role="alert" className="bl-error">{archive.error.message}</p>}
            <div className="bl-form-actions"><button type="button" className="bl-quiet" onClick={() => setConfirmArchive(false)}>Cancel</button><button type="button" className="bl-button" disabled={archive.isPending} onClick={() => archive.mutate()}>{archive.isPending ? "Archiving…" : "Archive project"}</button></div>
          </div>
        </Dialog>
      )}

      {confirmRestore && (
        <Dialog title="Restore project" onClose={() => setConfirmRestore(false)}>
          <div className="bl-form">
            <p>The project and its review links will be available again.</p>
            {restore.error && <p role="alert" className="bl-error">{restore.error.message}</p>}
            <div className="bl-form-actions"><button type="button" className="bl-quiet" onClick={() => setConfirmRestore(false)}>Cancel</button><button type="button" className="bl-button" disabled={restore.isPending} onClick={() => restore.mutate()}>{restore.isPending ? "Restoring…" : "Restore project"}</button></div>
          </div>
        </Dialog>
      )}

      {showHardDelete && (
        <HardDeleteDialog
          project={project}
          onClose={() => setShowHardDelete(false)}
          onDeleted={async () => {
            await refreshWorkspace();
            setShowHardDelete(false);
            // Navigating to the workspace root is a no-op if we're already there (the
            // dashboard list), and gets a viewer off a now-404 project detail page.
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
      <div className="bl-form" style={{ width: 440, maxWidth: "100%" }}>
        {preview.isLoading && <p className="bl-mono">Checking what would be deleted…</p>}
        {preview.isError && (
          <p role="alert" className="bl-error">
            {preview.error instanceof Error ? preview.error.message : "Could not prepare this deletion."}
          </p>
        )}

        {preview.data && !isArchived && (
          <p>Archive <strong>{project.name}</strong> first — permanent deletion is only available for already-archived projects.</p>
        )}

        {preview.data && isArchived && (
          <>
            <p>This permanently deletes <strong>{project.name}</strong> and everything in it. This cannot be undone.</p>
            <ul className="bl-mono" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", listStyle: "none", padding: 0, margin: 0 }}>
              <li>Pages: {preview.data.counts.pages}</li>
              <li>Comments: {preview.data.counts.comments}</li>
              <li>Assets: {preview.data.counts.project_assets}</li>
              <li>Revisions: {preview.data.counts.revisions}</li>
              <li>Share links: {preview.data.counts.share_links}</li>
              <li>Notifications: {preview.data.counts.notifications}</li>
            </ul>
            <p className="bl-mono">{preview.data.retention_notice}</p>

            {confirm.isError && (
              <p role="alert" className="bl-error">
                {confirm.error instanceof Error ? confirm.error.message : "Could not delete this project."}
              </p>
            )}

            <label>Type <strong>{project.name}</strong> to confirm<input className="bl-input" value={typedName} onChange={(e) => setTypedName(e.target.value)} autoFocus /></label>
          </>
        )}

        <div className="bl-form-actions">
          <button type="button" className="bl-quiet" onClick={onClose}>Cancel</button>
          {preview.data && isArchived && (
            <button
              type="button"
              className="bl-button"
              style={{ background: "#A33317" }}
              disabled={!nameMatches || confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending ? "Deleting…" : "Delete forever"}
            </button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
