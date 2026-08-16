import { Button } from "@backline/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import * as shareLinksApi from "../share-links/api";
import * as workspacesApi from "./api";
import type { ProjectOut } from "../projects/api";

function reviewUrl(token: string): string {
  return `${window.location.origin}/review/${token}`;
}

interface ShareProjectModalProps {
  project: ProjectOut;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  onClose: () => void;
}

// Deliberately two distinct sections, not one blended "invite" like the reference this
// was modeled on: this product has no per-project permissions, so inviting someone by
// email always adds them to the whole workspace (every project), while the client
// review link is genuinely project-scoped. Blurring those together would misrepresent
// what access someone's actually getting.
export function ShareProjectModal({
  project,
  workspaceId,
  workspaceSlug,
  workspaceName,
  onClose,
}: ShareProjectModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [copied, setCopied] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { data: shareLinks } = useQuery({
    queryKey: ["project", project.id, "share-links"],
    queryFn: () => shareLinksApi.listShareLinks(project.id),
  });
  const activeLink = (shareLinks ?? []).find((link) => link.revoked_at === null);

  const inviteMutation = useMutation({
    mutationFn: () => workspacesApi.inviteMember(workspaceId, email.trim(), role),
    onSuccess: () => setEmail(""),
  });

  async function copyLink() {
    if (!activeLink) return;
    await navigator.clipboard.writeText(reviewUrl(activeLink.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    inviteMutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Share ${project.name}`}
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex w-full max-w-md flex-col gap-5 rounded-lg p-5 dark:bg-[#14141A]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">Share &quot;{project.name}&quot;</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted text-lg leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleInvite} className="flex flex-col gap-2">
          <label className="text-xs font-medium">Invite a teammate</label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              required
              placeholder="someone@youragency.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            />
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "member" | "admin")}
              aria-label="Role"
              className="rounded-md border border-black/10 px-2 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <Button type="submit" disabled={inviteMutation.isPending}>
              Invite
            </Button>
          </div>
          <p className="text-text-muted text-xs">
            Adds them to the <strong>{workspaceName}</strong> workspace, with access to every
            project - this app doesn&apos;t have per-project permissions yet.
          </p>
          {inviteMutation.isError && (
            <p className="text-recovery-orphaned text-xs">Could not send that invite.</p>
          )}
          {inviteMutation.isSuccess && (
            <p className="text-status-resolved text-xs">Invite sent.</p>
          )}
        </form>

        <div className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <label className="text-xs font-medium">Client review link</label>
          {activeLink ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={reviewUrl(activeLink.token)}
                aria-label="Client review link"
                onFocus={(event) => event.target.select()}
                className="text-text-muted flex-1 truncate rounded-md border border-black/10 px-3 py-2 text-xs dark:border-white/10"
              />
              <Button variant="secondary" onClick={copyLink}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          ) : (
            <p className="text-text-muted text-xs">No active share link for this project.</p>
          )}
          <Link
            to={`/w/${workspaceSlug}/p/${project.id}/share-links`}
            className="text-accent-primary text-xs underline"
            onClick={onClose}
          >
            Manage share links (passcodes, more links, revoke) →
          </Link>
        </div>
      </div>
    </div>
  );
}
