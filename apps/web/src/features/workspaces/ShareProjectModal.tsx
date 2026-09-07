import { Button } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import * as shareLinksApi from "../share-links/api";
import * as workspacesApi from "./api";
import type { ProjectOut } from "../projects/api";
import { useUnsavedChanges } from "../../lib/use-unsaved-changes";
import { useFocusTrap } from "../../lib/use-focus-trap";

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
  const [passcode, setPasscode] = useState("");
  const [domainRestrictionsStr, setDomainRestrictionsStr] = useState("");
  const [expiration, setExpiration] = useState<"never" | "7" | "30">("never");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const isDirty = email.trim().length > 0 || passcode.trim().length > 0 || domainRestrictionsStr.trim().length > 0;
  useUnsavedChanges(isDirty);
  useFocusTrap(dialogRef, true);

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

  const createMutation = useMutation({
    mutationFn: () =>
      shareLinksApi.createShareLink(project.id, {
        mode: "proxy",
        passcode: passcode.trim() || undefined,
        askReviewerName: true,
        domainRestrictions: domainRestrictionsStr.split(',').map(s => s.trim()).filter(Boolean),
        expiresAt: expiration === "never" ? undefined : new Date(Date.now() + Number(expiration) * 24 * 60 * 60 * 1000).toISOString(),
      }),
    onSuccess: () => {
      setPasscode("");
      setDomainRestrictionsStr("");
      return queryClient.invalidateQueries({ queryKey: ["project", project.id, "share-links"] });
    },
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

  function handleCreateLink(event: React.FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
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
                aria-invalid={!email.trim()}
                className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500"
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
            <form onSubmit={handleCreateLink} className="flex flex-col gap-3">
              <p className="text-text-muted text-xs">No active share link for this project. Create one below.</p>
              <label className="flex flex-col gap-1 text-xs">
                Passcode (optional)
                <input
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  className="rounded-md border border-black/10 px-3 py-1.5 dark:border-white/10 dark:bg-transparent"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Domain restrictions (comma-separated, optional)
                <input
                  value={domainRestrictionsStr}
                  onChange={(event) => setDomainRestrictionsStr(event.target.value)}
                  placeholder="example.com"
                  className="rounded-md border border-black/10 px-3 py-1.5 dark:border-white/10 dark:bg-transparent"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Expiration policy
                <select
                  value={expiration}
                  onChange={(event) => setExpiration(event.target.value as "never" | "7" | "30")}
                  className="rounded-md border border-black/10 px-2 py-1.5 dark:border-white/10 dark:bg-transparent"
                >
                  <option value="never">Never expires</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                </select>
              </label>
              <Button type="submit" disabled={createMutation.isPending}>
                Create share link
              </Button>
            </form>
          )}
          <Link
            to={`/w/${workspaceSlug}/p/${project.id}/share-links`}
            className="text-accent-primary text-xs underline mt-2"
            onClick={onClose}
          >
            Manage share links (passcodes, more links, revoke) →
          </Link>
        </div>
      </div>
    </div>
  );
}
