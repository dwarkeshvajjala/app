import { Avatar } from "@backline/ui";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import * as boardApi from "../../board/api";
import * as pagesApi from "../../pages/api";
import { qk } from "../../../lib/query-keys";
import * as workspacesApi from "../../workspaces/api";
import type { ProjectOut } from "../api";
import { CollaboratorsModal } from "./CollaboratorsModal";

interface DetailsTabProps {
  project: ProjectOut;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

function formatAddedOn(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "Page Overview" + "Collaborators" - real data throughout (no per-link view/comment
// roles or granular link settings shown here, since this app doesn't have that model;
// see CollaboratorsModal's own note on where it simplifies the reference design).
export function DetailsTab({
  project,
  workspaceId,
  workspaceSlug,
  workspaceName,
}: DetailsTabProps) {
  const [showCollaborators, setShowCollaborators] = useState(false);

  const { data: members } = useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => workspacesApi.listMembers(workspaceId),
  });
  const { data: comments } = useQuery({
    queryKey: qk.projectComments(project.id),
    queryFn: () => boardApi.listProjectComments(project.id),
  });
  const { data: pages } = useQuery({
    queryKey: qk.projectPages(project.id),
    queryFn: () => pagesApi.listProjectPages(project.id),
  });

  const creator = (members ?? []).find((member) => member.user_id === project.created_by);
  const totalComments = comments?.length ?? 0;
  const resolvedComments = (comments ?? []).filter((c) => c.status === "resolved").length;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold">Page Overview</h3>
        <div className="border-black/8 flex flex-col gap-4 rounded-lg border bg-white p-4 dark:border-white/10 dark:bg-white/5">
          {creator && (
            <div className="flex items-center gap-3 border-b border-black/10 pb-3 dark:border-white/10">
              <Avatar name={creator.name} avatarUrl={creator.avatar_url} size={32} />
              <div>
                <p className="text-sm font-semibold">{creator.name}</p>
                <p className="text-accent-primary text-xs">
                  Added on {formatAddedOn(project.created_at)}
                </p>
              </div>
            </div>
          )}
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between">
              <dt>Total Comments</dt>
              <dd className="text-accent-primary font-semibold">{totalComments}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Resolved Comments</dt>
              <dd className="text-accent-primary font-semibold">{resolvedComments}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Versions</dt>
              <dd className="text-accent-primary font-semibold">{pages?.length ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-black/10 pt-2 dark:border-white/10">
              <dt>URL</dt>
              <dd>
                <a
                  href={project.target_origin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open project URL"
                  className="text-accent-primary"
                >
                  ↗
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Collaborators ({members?.length ?? 0})</h3>
        </div>
        <button
          onClick={() => setShowCollaborators(true)}
          className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-black/10 py-2.5 text-sm font-medium dark:border-white/10"
        >
          + Add New
        </button>
        <div className="flex flex-col gap-2">
          {(members ?? []).map((member) => (
            <div
              key={member.id}
              className="border-black/8 flex items-center gap-3 rounded-lg border bg-white p-3 dark:border-white/10 dark:bg-white/5"
            >
              <Avatar name={member.name} avatarUrl={member.avatar_url} size={32} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{member.name}</p>
                <span className="text-text-muted inline-block rounded-md border border-black/10 px-2 py-0.5 text-xs dark:border-white/10">
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showCollaborators && (
        <CollaboratorsModal
          project={project}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          onClose={() => setShowCollaborators(false)}
        />
      )}
    </div>
  );
}
