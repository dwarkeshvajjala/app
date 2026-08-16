import { Avatar, Button } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import * as shareLinksApi from "../../share-links/api";
import * as workspacesApi from "../../workspaces/api";
import type { ProjectOut } from "../api";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function reviewUrl(token: string): string {
  return `${window.location.origin}/review/${token}`;
}

interface CollaboratorsModalProps {
  project: ProjectOut;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  onClose: () => void;
}

// Visually modeled on a reference design with per-link "View"/"Comment" viewer roles
// and a settings checklist (page versions, device sizes, all pages) - this app has
// neither concept (a project's share link is a single all-or-nothing "can this guest
// see and comment on client-visible threads" toggle, and inviting someone always
// grants full workspace membership, not a scoped viewer role), so those are mapped to
// what's actually real here instead of faked: the invite role dropdown offers this
// app's real Member/Admin workspace roles, and the settings gear links to the full
// Share Links page (passcode/expiry/mode) rather than a fake checklist.
export function CollaboratorsModal({
  project,
  workspaceId,
  workspaceSlug,
  workspaceName,
  onClose,
}: CollaboratorsModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: members } = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    queryFn: () => workspacesApi.listMembers(workspaceId),
  });

  const shareLinksQuery = useQuery({
    queryKey: ["project", project.id, "share-links"],
    queryFn: () => shareLinksApi.listShareLinks(project.id),
  });
  const activeLink = (shareLinksQuery.data ?? []).find((link) => link.revoked_at === null);

  const inviteMutation = useMutation({
    mutationFn: () => workspacesApi.inviteMember(workspaceId, email.trim(), role),
    onSuccess: () => {
      setEmail("");
      queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "members"] });
    },
  });

  const createLinkMutation = useMutation({
    mutationFn: () => shareLinksApi.createShareLink(project.id, { mode: "proxy" }),
    onSuccess: () => shareLinksQuery.refetch(),
  });
  const revokeLinkMutation = useMutation({
    mutationFn: (shareLinkId: string) => shareLinksApi.revokeShareLink(shareLinkId),
    onSuccess: () => shareLinksQuery.refetch(),
  });

  function toggleGeneralAccess() {
    if (activeLink) {
      revokeLinkMutation.mutate(activeLink.id);
    } else {
      createLinkMutation.mutate();
    }
  }

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
        className="bg-bg-surface flex w-full max-w-lg flex-col gap-5 rounded-xl p-6 dark:bg-[#14141A]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">Share &quot;{project.name}&quot;</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close"
            className="text-text-muted text-xl leading-none"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleInvite} className="flex items-center gap-2">
          <input
            type="email"
            required
            placeholder={`someone@${workspaceName.toLowerCase().replace(/\s+/g, "")}.com`}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="flex-1 rounded-md border border-black/10 px-3 py-2.5 text-sm dark:border-white/10 dark:bg-transparent"
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as "member" | "admin")}
            aria-label="Role"
            className="rounded-md border border-black/10 px-2 py-2.5 text-sm dark:border-white/10 dark:bg-transparent"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button type="submit" disabled={inviteMutation.isPending}>
            Invite
          </Button>
        </form>
        {inviteMutation.isError && (
          <p className="text-recovery-orphaned -mt-3 text-xs">Could not send that invite.</p>
        )}

        <div className="flex flex-col gap-3">
          {(members ?? []).map((member) => (
            <div key={member.id} className="flex items-center gap-3">
              <Avatar name={member.name} avatarUrl={member.avatar_url} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  {member.user_id === user?.id && (
                    <span className="bg-accent-primary/10 text-accent-primary rounded-full px-2 py-0.5 text-xs font-medium">
                      You
                    </span>
                  )}
                  <span className="text-text-muted rounded-md border border-black/10 px-2 py-0.5 text-xs dark:border-white/10">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </div>
                <p className="text-accent-primary truncate text-xs">{member.email}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 border-t border-black/10 pt-4 dark:border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">General access</span>
            <button
              role="switch"
              aria-checked={!!activeLink}
              aria-label="Anyone with the link can access this project"
              onClick={toggleGeneralAccess}
              disabled={createLinkMutation.isPending || revokeLinkMutation.isPending}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                activeLink ? "bg-accent-primary" : "bg-black/15 dark:bg-white/15"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  activeLink ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <p className="text-accent-primary text-xs">
            {activeLink
              ? "Anyone with the link can access this project."
              : "No one can access this project via link right now."}
          </p>
          {activeLink && (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={reviewUrl(activeLink.token)}
                aria-label="Client review link"
                onFocus={(event) => event.target.select()}
                className="text-text-muted flex-1 truncate rounded-md border border-black/10 px-3 py-2 text-xs dark:border-white/10"
              />
              <Button variant="secondary" onClick={copyLink}>
                {copied ? "Copied!" : "Copy Link"}
              </Button>
              <Link
                to={`/w/${workspaceSlug}/p/${project.id}/share-links`}
                aria-label="Manage share link settings (passcode, expiry, mode)"
                onClick={onClose}
                className="text-text-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-black/10 dark:border-white/10"
              >
                ⚙
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
