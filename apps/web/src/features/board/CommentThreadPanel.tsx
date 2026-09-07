import { LayerBadge } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";

import type { Schemas } from "@backline/types";
import { PaperclipIcon } from "../../components/icons";
import { patchProjectComment, upsertProjectComment } from "../../lib/comment-cache";
import { qk } from "../../lib/query-keys";
import * as workspaceApi from "../workspaces/api";
import { MentionsInput } from "../comments/MentionsInput";
import * as boardApi from "./api";
import type { CommentLayer, CommentOut } from "./api";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ThreadMessage({ comment }: { comment: CommentOut }) {
  return (
    <div className="rounded-md border border-black/10 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <LayerBadge layer={comment.layer} />
        <span className="text-text-muted text-xs">
          {comment.author_type === "guest" ? "Guest" : "Member"} · {formatTime(comment.created_at)}
        </span>
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap">{comment.body}</p>
    </div>
  );
}

interface CommentThreadPanelProps {
  comment: CommentOut;
  replies: CommentOut[];
  projectId: string;
  onClose: () => void;
}

// A minimal thread view (16-Dashboard.md's "Thread view"): the Board previously only
// showed each top-level comment as a card with no way to read or post a reply, so
// team-only discussion (F3, the product's core client/team-layer differentiator) had no
// UI at all despite being fully supported server-side since M4. This is the panel that
// closes that gap - reply list plus a layer-aware composer, nothing more.
export function CommentThreadPanel({
  comment,
  replies,
  projectId,
  onClose,
}: CommentThreadPanelProps) {
  const { workspaceSlug } = useParams();
  const [body, setBody] = useState("");
  const [layer, setLayer] = useState<CommentLayer>("client");
  const [attachments, setAttachments] = useState<Schemas["AttachmentIn"][]>([]);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // We need the workspace ID to list members. We can get it from the workspace object if available.
  const workspaceQuery = useQuery({
    queryKey: qk.workspaces(),
    queryFn: async () => {
      const ws = await workspaceApi.listWorkspaces();
      return ws.find(w => w.slug === workspaceSlug);
    },
    enabled: !!workspaceSlug
  });

  const membersQuery = useQuery({
    queryKey: qk.members(workspaceQuery.data?.id),
    queryFn: () => workspaceApi.listMembers(workspaceQuery.data!.id),
    enabled: !!workspaceQuery.data?.id,
  });

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const replyMutation = useMutation({
    mutationFn: () =>
      boardApi.createReply(comment.id, body.trim(), layer, attachments, mentionedUserIds),
    onSuccess: (created) => {
      setBody("");
      setAttachments([]);
      setMentionedUserIds([]);
      // The board's own comment.created WS handler (BoardPage's upsertComment) will
      // also receive this via the broadcast this create triggers server-side, but that
      // path is fire-and-forget over the socket - upserting here too means the reply
      // the author themselves just posted appears immediately, not after a round trip.
      // Upsert by id, not a blind append: if the WS event already landed first, this
      // would otherwise add a second, duplicate copy of the same reply.
      upsertProjectComment(queryClient, projectId, created);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof boardApi.updateComment>[1]) => 
      boardApi.updateComment(comment.id, patch),
    onSuccess: (updated) => {
      patchProjectComment(queryClient, projectId, updated.id, updated);
    }
  });

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      const newAttachments: Schemas["AttachmentIn"][] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploadInfo = await boardApi.createUpload(projectId, file.type);
        await fetch(uploadInfo.upload_url, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });
        newAttachments.push({
          key: uploadInfo.key,
          filename: file.name,
          content_type: file.type,
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (err) {
      console.error("Failed to upload attachment", err);
    } finally {
      setIsUploading(false);
    }
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    replyMutation.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/30 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Comment thread"
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex h-full w-full max-w-4xl flex-col gap-4 overflow-hidden rounded-md dark:bg-[#14141A]"
      >
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10 shrink-0">
          <h2 className="text-sm font-semibold">Thread</h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close thread"
            className="text-text-muted text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-5">
            <ThreadMessage comment={comment} />

            {replies.length > 0 && (
              <div className="flex flex-col gap-2 border-l-2 border-black/10 pl-3 mt-4 dark:border-white/10">
                {replies.map((reply) => (
                  <ThreadMessage key={reply.id} comment={reply} />
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-auto flex flex-col gap-2 pt-6">
              <label className="flex flex-col gap-1 text-sm">
                Reply
                <MentionsInput
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  onMentionedIdsChange={setMentionedUserIds}
                  rows={3}
                  required
                  className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
                />
              </label>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {attachments.map(att => (
                    <div key={att.key} className="flex items-center gap-1 text-xs bg-black/5 dark:bg-white/5 rounded px-2 py-1">
                      <span className="truncate max-w-[150px]">{att.filename}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter(a => a.key !== att.key))}
                        className="text-text-muted hover:text-text-primary ml-1"
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <select
                      value={layer}
                      onChange={(event) => setLayer(event.target.value as CommentLayer)}
                      aria-label="Reply visibility"
                      className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
                    >
                      <option value="client">Client visible</option>
                      <option value="team">Team only</option>
                    </select>
                  </label>
                  <label className="text-xs text-text-muted hover:text-text-primary cursor-pointer border border-transparent hover:border-black/10 dark:hover:border-white/10 rounded-md px-2 py-1">
                    {isUploading ? "Uploading..." : <span className="inline-flex items-center gap-1"><PaperclipIcon width="14" height="14" /> Attach</span>}
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={replyMutation.isPending || !body.trim()}
                  className="bg-accent-primary rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {replyMutation.isPending ? "Posting..." : "Post reply"}
                </button>
              </div>
              {replyMutation.isError && (
                <p className="text-recovery-orphaned text-xs">Could not post your reply.</p>
              )}
            </form>
          </div>

          {/* Metadata Sidebar */}
          <div className="w-64 shrink-0 border-l border-black/10 px-4 pb-5 overflow-y-auto dark:border-white/10">
            <div className="flex flex-col gap-4 pt-4">
              <label className="flex flex-col gap-1 text-xs font-medium">
                Status
                <select
                  value={comment.status}
                  onChange={(e) => updateMutation.mutate({ status: e.target.value as Schemas["CommentUpdate"]["status"] })}
                  className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-transparent"
                >
                  <option value="todo">Active</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="blocked">Blocked</option>
                  <option value="resolved">Resolved</option>
                  <option value="wont_fix">Won't Fix</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Priority
                <select
                  value={comment.priority || "medium"}
                  onChange={(e) => updateMutation.mutate({ priority: e.target.value as Schemas["CommentUpdate"]["priority"] })}
                  className="rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-transparent"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Due Date
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={comment.due_at ? comment.due_at.split("T")[0] : ""}
                    onChange={(e) => updateMutation.mutate({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    className="flex-1 rounded-md border border-black/10 px-2 py-1.5 text-xs dark:border-white/10 dark:bg-transparent"
                  />
                  {comment.due_at && (
                    <button
                      onClick={() => updateMutation.mutate({ due_at: null })}
                      className="text-text-muted hover:text-text-primary text-xs"
                      title="Clear due date"
                    >
                      ×
                    </button>
                  )}
                </div>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Tags
                <div className="flex flex-wrap gap-1 mt-1">
                  {(["Bug", "Copy", "Design", "Responsive", "Content", "Accessibility"] as const).map(tag => {
                    const active = comment.tags?.includes(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => {
                          const tags = new Set(comment.tags || []);
                          if (active) tags.delete(tag);
                          else tags.add(tag);
                          updateMutation.mutate({ tags: Array.from(tags) });
                        }}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium border ${
                          active 
                            ? "bg-accent-primary border-accent-primary text-white" 
                            : "border-black/10 text-text-muted hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
                        }`}
                      >
                        {tag}
                      </button>
                    )
                  })}
                </div>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Assignees
                <select
                  multiple
                  size={3}
                  value={comment.assignee_ids || []}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions).map(o => o.value);
                    updateMutation.mutate({ assignee_ids: options });
                  }}
                  className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
                >
                  {membersQuery.data?.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-medium">
                Waiting On
                <select
                  multiple
                  size={3}
                  value={comment.waiting_on_ids || []}
                  onChange={(e) => {
                    const options = Array.from(e.target.selectedOptions).map(o => o.value);
                    updateMutation.mutate({ waiting_on_ids: options });
                  }}
                  className="rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10 dark:bg-transparent"
                >
                  {membersQuery.data?.map(m => (
                    <option key={m.id} value={m.id}>{m.name || m.email}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={comment.waiting_on_client}
                  onChange={(e) => updateMutation.mutate({ waiting_on_client: e.target.checked })}
                />
                Waiting on Client
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
