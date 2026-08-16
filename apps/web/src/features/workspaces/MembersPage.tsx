import { Avatar, Button } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { qk } from "../../lib/query-keys";
import * as projectsApi from "../projects/api";
import * as workspacesApi from "./api";
import type { WorkspaceOut } from "./api";

// usePermission-style check: UI-only, purely to avoid showing controls the user can't
// use - the backend re-checks every one of these against the same matrix regardless
// (05-Frontend-Architecture.md §5.5, 13-Authentication.md §13.5).
function canManageMembers(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

interface AddMemberModalProps {
  onInvite: (email: string, role: "admin" | "member") => Promise<void>;
  onClose: () => void;
}

function AddMemberModal({ onInvite, onClose }: AddMemberModalProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onInvite(email, role);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add member"
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex w-full max-w-sm flex-col gap-3 rounded-lg p-5 dark:bg-[#14141A]"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">Add member</h2>
          <button onClick={onClose} aria-label="Close" className="text-text-muted text-lg leading-none">
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input
              required
              type="email"
              autoFocus
              placeholder="teammate@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Role
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as "admin" | "member")}
              className="rounded-md border border-black/10 px-2 py-2 dark:border-white/10 dark:bg-transparent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
          <Button type="submit" disabled={isSubmitting}>
            Send invite
          </Button>
        </form>
      </div>
    </div>
  );
}

export function MembersPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { role: myRole } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: members, isLoading } = useQuery({
    queryKey: qk.members(workspace.id),
    queryFn: () => workspacesApi.listMembers(workspace.id),
  });

  const { data: projects } = useQuery({
    queryKey: ["workspace", workspace.id, "projects"],
    queryFn: () => projectsApi.listProjects(workspace.id),
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: qk.members(workspace.id) });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: "admin" | "member" }) =>
      workspacesApi.inviteMember(workspace.id, email, role),
    onSuccess: invalidateMembers,
  });

  const roleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: "admin" | "member" }) =>
      workspacesApi.updateMemberRole(workspace.id, memberId, role),
    onSuccess: invalidateMembers,
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => workspacesApi.removeMember(workspace.id, memberId),
    onSuccess: invalidateMembers,
  });

  const canManage = canManageMembers(myRole);
  const visibleMembers = (members ?? []).filter(
    (m) =>
      m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
      m.email.toLowerCase().includes(search.trim().toLowerCase()),
  );
  // Membership is workspace-wide, not per-project (there's no per-project ACL in this
  // app) - every member can see every project in the workspace, so this column is the
  // same real count for each row rather than a fabricated per-member breakdown.
  const projectCount = projects?.length ?? 0;

  return (
    <main className="px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Team Members</h1>
        {canManage && (
          <Button onClick={() => setShowAddMember(true)}>+ Add Member</Button>
        )}
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search by name or email..."
        aria-label="Search members"
        className="mt-4 w-full max-w-sm rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
      />

      {isLoading && <p className="text-text-muted mt-6 text-sm">Loading...</p>}

      {members && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-muted border-b border-black/10 text-xs font-semibold tracking-wide uppercase dark:border-white/10">
                <th className="py-2 pr-4 font-semibold">Name</th>
                <th className="py-2 pr-4 font-semibold">Role</th>
                <th className="py-2 pr-4 font-semibold">Project</th>
                {canManage && <th className="py-2 font-semibold" />}
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((member) => (
                <tr key={member.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={member.name} avatarUrl={member.avatar_url} size={32} />
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-text-muted text-xs">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {canManage && member.role !== "owner" ? (
                      <select
                        value={member.role}
                        onChange={(event) =>
                          roleMutation.mutate({
                            memberId: member.id,
                            role: event.target.value as "admin" | "member",
                          })
                        }
                        aria-label={`Change role for ${member.name}`}
                        className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs capitalize dark:border-white/10"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                      </select>
                    ) : (
                      <span className="capitalize">{member.role}</span>
                    )}
                  </td>
                  <td className="text-text-muted py-3 pr-4">
                    {projectCount} Project{projectCount === 1 ? "" : "s"}
                  </td>
                  {canManage && (
                    <td className="py-3 text-right">
                      {member.role !== "owner" && (
                        <button
                          className="text-recovery-orphaned text-xs underline"
                          onClick={() => removeMutation.mutate(member.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-text-muted mt-3 text-xs">{visibleMembers.length} users</p>
        </div>
      )}

      {showAddMember && (
        <AddMemberModal
          onInvite={async (email, role) => {
            await inviteMutation.mutateAsync({ email, role });
          }}
          onClose={() => setShowAddMember(false)}
        />
      )}
    </main>
  );
}
