import { LayerBadge } from "@backline/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { qk } from "../../lib/query-keys";
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
  const [body, setBody] = useState("");
  const [layer, setLayer] = useState<CommentLayer>("client");
  const queryClient = useQueryClient();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const replyMutation = useMutation({
    mutationFn: () => boardApi.createReply(comment.id, body.trim(), layer),
    onSuccess: (created) => {
      setBody("");
      // The board's own comment.created WS handler (BoardPage's upsertComment) will
      // also receive this via the broadcast this create triggers server-side, but that
      // path is fire-and-forget over the socket - upserting here too means the reply
      // the author themselves just posted appears immediately, not after a round trip.
      // Upsert by id, not a blind append: if the WS event already landed first, this
      // would otherwise add a second, duplicate copy of the same reply.
      queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId), (old) => {
        if (!old) return old;
        const existingIndex = old.findIndex((c) => c.id === created.id);
        if (existingIndex === -1) return [...old, created];
        const next = [...old];
        next[existingIndex] = created;
        return next;
      });
    },
  });

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
        className="bg-bg-surface flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto rounded-md p-5 dark:bg-[#14141A]"
      >
        <div className="flex items-start justify-between gap-2">
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

        <ThreadMessage comment={comment} />

        {replies.length > 0 && (
          <div className="flex flex-col gap-2 border-l-2 border-black/10 pl-3 dark:border-white/10">
            {replies.map((reply) => (
              <ThreadMessage key={reply.id} comment={reply} />
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-auto flex flex-col gap-2 pt-2">
          <label className="flex flex-col gap-1 text-sm">
            Reply
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              required
              className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
            />
          </label>
          <div className="flex items-center justify-between gap-2">
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
    </div>
  );
}
