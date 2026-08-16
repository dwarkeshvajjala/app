import { LayerBadge, RecoveryBadge, StatusBadge } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";

import * as integrationsApi from "../integrations/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as workspacesApi from "../workspaces/api";
import { useWSEvent } from "../../app/WSProvider";
import { qk } from "../../lib/query-keys";
import { useConnectionStore } from "../../stores/connectionStore";
import { usePresenceStore } from "../../stores/presenceStore";
import * as boardApi from "./api";
import type { CommentOut, CommentStatus } from "./api";
import { CommentThreadPanel } from "./CommentThreadPanel";

const CONNECTION_LABEL: Record<string, string> = {
  connected: "Live",
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
  disconnected: "Offline",
};

const CONNECTION_DOT: Record<string, string> = {
  connected: "bg-status-resolved",
  connecting: "bg-status-in-progress",
  reconnecting: "bg-status-in-progress",
  disconnected: "bg-status-wont-fix",
};

const STATUSES: CommentStatus[] = ["todo", "in_progress", "resolved", "wont_fix"];
const STATUS_LABELS: Record<CommentStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

function commentContext(comment: CommentOut): { device_type?: string; url?: string } {
  return comment.context as { device_type?: string; url?: string };
}

interface Filters {
  status: string;
  layer: string;
  assignee: string;
  device: string;
  page: string;
}

function filtersFromParams(params: URLSearchParams): Filters {
  return {
    status: params.get("status") ?? "",
    layer: params.get("layer") ?? "",
    assignee: params.get("assignee") ?? "",
    device: params.get("device") ?? "",
    page: params.get("page") ?? "",
  };
}

export function BoardPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const filters = filtersFromParams(searchParams);

  function setFilter(key: keyof Filters, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }

  const { data: comments, isLoading } = useQuery({
    queryKey: qk.projectComments(projectId ?? ""),
    queryFn: () => boardApi.listProjectComments(projectId!),
    enabled: !!projectId,
  });

  const { data: members } = useQuery({
    queryKey: qk.members(workspace.id),
    queryFn: () => workspacesApi.listMembers(workspace.id),
  });

  const { data: integrations } = useQuery({
    queryKey: ["workspace", workspace.id, "integrations"],
    queryFn: () => integrationsApi.listIntegrations(workspace.id),
  });
  const clickupIntegration = (integrations ?? []).find((i) => i.type === "clickup");
  const trelloIntegration = (integrations ?? []).find((i) => i.type === "trello");
  const [taskLinks, setTaskLinks] = useState<Record<string, string>>({});

  const createClickUpTaskMutation = useMutation({
    mutationFn: (commentId: string) =>
      integrationsApi.createClickUpTask(commentId, clickupIntegration!.id),
    onSuccess: (result, commentId) =>
      setTaskLinks((prev) => ({ ...prev, [commentId]: result.task_url })),
  });
  const createTrelloCardMutation = useMutation({
    mutationFn: (commentId: string) =>
      integrationsApi.createTrelloCard(commentId, trelloIntegration!.id),
    onSuccess: (result, commentId) =>
      setTaskLinks((prev) => ({ ...prev, [commentId]: result.card_url })),
  });

  const memberName = useMemo(() => {
    const byId = new Map((members ?? []).map((member) => [member.user_id, member.name]));
    return (userId: string | null) => (userId ? (byId.get(userId) ?? "Unknown") : null);
  }, [members]);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.projectComments(projectId ?? "") });

  const connectionStatus = useConnectionStore((state) => state.status);
  const presenceByPageId = usePresenceStore((state) => state.byPageId);

  // Targeted cache merges on live events, not a blind invalidate (14-State-Management.md
  // §14.4) - a busy review session would otherwise thrash the board with full refetches.
  const upsertComment = useCallback(
    (payload: CommentOut & { project_id: string }) => {
      if (payload.project_id !== projectId) return;
      queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId ?? ""), (old) => {
        if (!old) return old;
        const existingIndex = old.findIndex((c) => c.id === payload.id);
        if (existingIndex === -1) return [...old, payload];
        const next = [...old];
        next[existingIndex] = payload;
        return next;
      });
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.created", upsertComment);
  useWSEvent("comment.updated", upsertComment);

  // comment.recovery_updated (10-Revision-Recovery.md §10.4) carries just
  // {comment_id, recovery_status, confidence} - no project_id, unlike
  // comment.created/updated - so instead of a project match, this patches by id and
  // silently no-ops if the id isn't in the currently-viewed project's cache (i.e. the
  // event was for a different project in the same workspace).
  const patchRecoveryStatus = useCallback(
    (payload: { comment_id: string; recovery_status: CommentOut["recovery_status"] }) => {
      queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId ?? ""), (old) => {
        if (!old) return old;
        const index = old.findIndex((c) => c.id === payload.comment_id);
        if (index === -1) return old;
        const next = [...old];
        next[index] = { ...next[index], recovery_status: payload.recovery_status };
        return next;
      });
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.recovery_updated", patchRecoveryStatus);

  // Widget-only feature (comment delete/reply are not exposed from this dashboard board
  // in this pass) - this just keeps the Board's own cache honest when a guest deletes a
  // comment or a whole thread from the widget canvas, so it doesn't linger here stale.
  const removeComment = useCallback(
    (payload: { comment_id: string; parent_id: string | null; project_id: string }) => {
      if (payload.project_id !== projectId) return;
      queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId ?? ""), (old) =>
        old ? old.filter((c) => c.id !== payload.comment_id) : old,
      );
      setOpenThreadId((current) => (current === payload.comment_id ? null : current));
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.deleted", removeComment);

  useWSEvent(
    "presence.updated",
    useCallback((payload: { page_id: string; active_sessions: string[] }) => {
      usePresenceStore.getState().setPresence(payload.page_id, payload.active_sessions);
    }, []),
  );

  // page_id -> url, so a presence.updated event (page-scoped) can be shown next to the
  // matching page filter option - the only place BoardPage otherwise keeps that mapping.
  const pageIdToUrl = useMemo(() => {
    const map = new Map<string, string>();
    for (const comment of comments ?? []) {
      const url = commentContext(comment).url;
      if (url) map.set(comment.page_id, url);
    }
    return map;
  }, [comments]);

  const reviewerCountByUrl = useMemo(() => {
    const counts = new Map<string, number>();
    for (const [pageId, sessions] of Object.entries(presenceByPageId)) {
      const url = pageIdToUrl.get(pageId);
      if (url) counts.set(url, sessions.length);
    }
    return counts;
  }, [presenceByPageId, pageIdToUrl]);

  const updateMutation = useMutation({
    mutationFn: ({
      commentId,
      patch,
    }: {
      commentId: string;
      patch: { status?: CommentStatus; assignee_id?: string | null };
    }) => boardApi.updateComment(commentId, patch),
    onSuccess: invalidate,
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (status: CommentStatus) =>
      Promise.all([...selected].map((id) => boardApi.updateComment(id, { status }))),
    onSuccess: () => {
      setSelected(new Set());
      invalidate();
    },
  });

  const pageUrls = useMemo(() => {
    const urls = new Set<string>();
    for (const comment of comments ?? []) {
      const url = commentContext(comment).url;
      if (url) urls.add(url);
    }
    return [...urls];
  }, [comments]);

  // Replies (parent_id set) share the same flat list as top-level comments
  // (`GET /projects/{id}/comments`) - grouped here rather than rendered as their own
  // board cards, which is what a top-level-only filter below guards against.
  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentOut[]>();
    for (const comment of comments ?? []) {
      if (!comment.parent_id) continue;
      const list = map.get(comment.parent_id) ?? [];
      list.push(comment);
      map.set(comment.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [comments]);

  const openThreadComment = (comments ?? []).find((c) => c.id === openThreadId) ?? null;

  const filtered = useMemo(() => {
    return (comments ?? []).filter((comment) => {
      if (comment.parent_id) return false;
      if (filters.status && comment.status !== filters.status) return false;
      if (filters.layer && comment.layer !== filters.layer) return false;
      if (filters.assignee && comment.assignee_id !== filters.assignee) return false;
      if (filters.device && commentContext(comment).device_type !== filters.device) return false;
      if (filters.page && commentContext(comment).url !== filters.page) return false;
      return true;
    });
  }, [comments, filters]);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (!projectId) {
    return <p className="text-recovery-orphaned p-6 text-sm">Missing project context.</p>;
  }

  if (isLoading) {
    return <p className="text-text-muted p-6 text-sm">Loading...</p>;
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Board</h1>
          <span className="text-text-muted flex items-center gap-1.5 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${CONNECTION_DOT[connectionStatus]}`}
              aria-hidden="true"
            />
            {CONNECTION_LABEL[connectionStatus]}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("kanban")}
            className={`rounded-md px-3 py-1.5 text-sm ${view === "kanban" ? "bg-accent-primary text-white" : "border border-black/10 dark:border-white/10"}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1.5 text-sm ${view === "list" ? "bg-accent-primary text-white" : "border border-black/10 dark:border-white/10"}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
          aria-label="Filter by status"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          value={filters.layer}
          onChange={(e) => setFilter("layer", e.target.value)}
          aria-label="Filter by layer"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All layers</option>
          <option value="client">Client visible</option>
          <option value="team">Team only</option>
        </select>
        <select
          value={filters.assignee}
          onChange={(e) => setFilter("assignee", e.target.value)}
          aria-label="Filter by assignee"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All assignees</option>
          {(members ?? []).map((member) => (
            <option key={member.id} value={member.user_id}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          value={filters.device}
          onChange={(e) => setFilter("device", e.target.value)}
          aria-label="Filter by device"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
        <select
          value={filters.page}
          onChange={(e) => setFilter("page", e.target.value)}
          aria-label="Filter by page"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All pages</option>
          {pageUrls.map((url) => {
            const reviewerCount = reviewerCountByUrl.get(url) ?? 0;
            return (
              <option key={url} value={url}>
                {url}
                {reviewerCount > 0 ? ` (${reviewerCount} reviewing)` : ""}
              </option>
            );
          })}
        </select>
      </div>

      {view === "kanban" ? (
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
      ) : (
        <div className="mt-6">
          {selected.size > 0 && (
            <div className="mb-3 flex items-center gap-3">
              <span className="text-text-muted text-xs">{selected.size} selected</span>
              <select
                onChange={(e) => {
                  if (e.target.value) bulkUpdateMutation.mutate(e.target.value as CommentStatus);
                  e.target.value = "";
                }}
                aria-label="Change status for selected comments"
                className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
              >
                <option value="">Change status to...</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-text-muted border-b border-black/10 text-xs dark:border-white/10">
                <th className="w-8 py-2">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === filtered.length}
                    onChange={(e) =>
                      setSelected(e.target.checked ? new Set(filtered.map((c) => c.id)) : new Set())
                    }
                    aria-label="Select all comments"
                  />
                </th>
                <th className="py-2">Comment</th>
                <th className="py-2">Layer</th>
                <th className="py-2">Status</th>
                <th className="py-2">Assignee</th>
                <th className="py-2">Anchor</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((comment) => (
                <tr key={comment.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(comment.id)}
                      onChange={() => toggleSelected(comment.id)}
                      aria-label={`Select comment: ${comment.body.slice(0, 60)}`}
                    />
                  </td>
                  <td className="max-w-xs truncate py-2">
                    <button
                      onClick={() => setOpenThreadId(comment.id)}
                      className="hover:underline"
                    >
                      {comment.body}
                      {(repliesByParent.get(comment.id)?.length ?? 0) > 0 && (
                        <span className="text-text-muted ml-1 text-xs">
                          ({repliesByParent.get(comment.id)?.length})
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="py-2">
                    <LayerBadge layer={comment.layer} />
                  </td>
                  <td className="py-2">
                    <StatusBadge status={comment.status} />
                  </td>
                  <td className="py-2">{memberName(comment.assignee_id) ?? "Unassigned"}</td>
                  <td className="py-2">
                    <RecoveryBadge status={comment.recovery_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openThreadComment && (
        <CommentThreadPanel
          comment={openThreadComment}
          replies={repliesByParent.get(openThreadComment.id) ?? []}
          projectId={projectId}
          onClose={() => setOpenThreadId(null)}
        />
      )}

      {filtered.length === 0 && (
        <p className="text-text-muted mt-8 text-sm">No comments match the current filters.</p>
      )}
    </main>
  );
}
