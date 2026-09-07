import { LayerBadge, RecoveryBadge } from "@backline/ui";
import type { UseMutationResult } from "@tanstack/react-query";

import { WORKFLOW_STATUSES as STATUSES, STATUS_LABELS } from "../../../lib/workflow";
import type {
  CreateClickUpTaskResult,
  CreateTrelloCardResult,
  IntegrationOut,
} from "../../integrations/api";
import type { CommentOut, CommentStatus } from "../api";
import { commentContext } from "./types";

interface KanbanBoardProps {
  filtered: CommentOut[];
  memberName: (userId: string | null) => string | null;
  repliesByParent: Map<string, CommentOut[]>;
  setOpenThreadId: (id: string | null) => void;
  updateMutation: UseMutationResult<
    CommentOut,
    Error,
    { commentId: string; patch: { status?: CommentStatus; assignee_id?: string | null } }
  >;
  taskLinks: Record<string, string>;
  clickupIntegration: IntegrationOut | undefined;
  trelloIntegration: IntegrationOut | undefined;
  createClickUpTaskMutation: UseMutationResult<CreateClickUpTaskResult, Error, string>;
  createTrelloCardMutation: UseMutationResult<CreateTrelloCardResult, Error, string>;
}

export function KanbanBoard({
  filtered,
  memberName,
  repliesByParent,
  setOpenThreadId,
  updateMutation,
  taskLinks,
  clickupIntegration,
  trelloIntegration,
  createClickUpTaskMutation,
  createTrelloCardMutation,
}: KanbanBoardProps) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STATUSES.map((status) => (
        <div key={status} className="flex flex-col gap-2">
          <h2 className="text-text-muted text-xs font-medium uppercase tracking-wide">
            {STATUS_LABELS[status]} ({filtered.filter((c) => c.status === status).length})
          </h2>
          <div className="flex flex-col gap-2">
            {filtered
              .filter((comment) => comment.status === status)
              .map((comment) => (
                <div
                  key={comment.id}
                  className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10"
                >
                  {comment.screenshot_url && (
                    <img
                      src={comment.screenshot_url}
                      alt=""
                      className="h-20 w-full rounded object-cover"
                    />
                  )}
                  <p className="line-clamp-3 text-sm">{comment.body}</p>
                  <div className="flex flex-wrap items-center gap-1">
                    <LayerBadge layer={comment.layer} />
                    <RecoveryBadge status={comment.recovery_status} />
                  </div>
                  <div className="text-text-muted flex items-center justify-between text-xs">
                    <span>{memberName(comment.assignee_id) ?? "Unassigned"}</span>
                    <span>{commentContext(comment).device_type ?? ""}</span>
                  </div>
                  <button
                    onClick={() => setOpenThreadId(comment.id)}
                    className="text-accent-primary self-start text-xs underline"
                  >
                    {(repliesByParent.get(comment.id)?.length ?? 0) > 0
                      ? `View thread (${repliesByParent.get(comment.id)?.length})`
                      : "Reply"}
                  </button>
                  <select
                    value={comment.status}
                    onChange={(e) =>
                      updateMutation.mutate({
                        commentId: comment.id,
                        patch: { status: e.target.value as CommentStatus },
                      })
                    }
                    aria-label="Change comment status"
                    className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  {taskLinks[comment.id] ? (
                    <a
                      href={taskLinks[comment.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent-primary text-xs underline"
                    >
                      View linked task
                    </a>
                  ) : (
                    <div className="flex gap-2">
                      {clickupIntegration && (
                        <button
                          onClick={() => createClickUpTaskMutation.mutate(comment.id)}
                          disabled={createClickUpTaskMutation.isPending}
                          className="text-text-muted text-xs underline"
                        >
                          Send to ClickUp
                        </button>
                      )}
                      {trelloIntegration && (
                        <button
                          onClick={() => createTrelloCardMutation.mutate(comment.id)}
                          disabled={createTrelloCardMutation.isPending}
                          className="text-text-muted text-xs underline"
                        >
                          Send to Trello
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
