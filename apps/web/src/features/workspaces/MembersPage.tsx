import { Button } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { qk } from "../../lib/query-keys";
import * as workspacesApi from "./api";
import type { WorkspaceOut } from "./api";

// usePermission-style check: UI-only, purely to avoid showing controls the user can't
// use - the backend re-checks every one of these against the same matrix regardless
// (05-Frontend-Architecture.md §5.5, 13-Authentication.md §13.5).
function canManageMembers(role: string | null): boolean {
  return role === "owner" || role === "admin";
}

export function MembersPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { role: myRole } = useAuth();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [error, setError] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: qk.members(workspace.id),
    queryFn: () => workspacesApi.listMembers(workspace.id),
  });

  const invalidateMembers = () =>
    queryClient.invalidateQueries({ queryKey: qk.members(workspace.id) });

  const inviteMutation = useMutation({
    mutationFn: () => workspacesApi.inviteMember(workspace.id, inviteEmail, inviteRole),
    onSuccess: () => {
      setInviteEmail("");
      invalidateMembers();
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    },
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

  function handleInvite(event: FormEvent) {
    event.preventDefault();
    setError(null);
    inviteMutation.mutate();
  }

  const canManage = canManageMembers(myRole);

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold">Members</h1>

      {isLoading && <p className="text-text-muted mt-4 text-sm">Loading...</p>}

      {members && (
        <ul className="mt-4 flex flex-col gap-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
            >
              <div>
                <p className="text-sm font-medium">{member.name}</p>
                <p className="text-text-muted text-xs">{member.email}</p>
              </div>
              <div className="flex items-center gap-3">
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
                    className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                ) : (
                  <span className="text-text-muted text-xs capitalize">{member.role}</span>
                )}
                {canManage && member.role !== "owner" && (
                  <button
                    className="text-recovery-orphaned text-xs underline"
                    onClick={() => removeMutation.mutate(member.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form
          className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10"
          onSubmit={handleInvite}
        >
          <h2 className="text-sm font-medium">Invite a teammate</h2>
          <div className="flex gap-2">
            <input
              type="email"
              required
              placeholder="teammate@company.com"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              className="flex-1 rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            />
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as "admin" | "member")}
              aria-label="Role for invited teammate"
              className="rounded-md border border-black/10 px-2 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
          <Button type="submit" disabled={inviteMutation.isPending}>
            Send invite
          </Button>
        </form>
      )}
    </main>
  );
}
