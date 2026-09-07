import { Avatar } from "@backline/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import * as boardApi from "../../../board/api";
import type { CommentOut, CommentStatus } from "../../../board/api";
import { qk } from "../../../../lib/query-keys";
import { timeAgo } from "../../../../lib/time";
import { MonitorIcon } from "../icons";
import { STATUS_META, STATUS_ORDER } from "./types";

export interface CommentRowProps {
  comment: CommentOut;
  projectId: string;
  sequenceNumber: number;
  onNavigate: (commentId: string) => void;
}

export function CommentRow({ comment, projectId, sequenceNumber, onNavigate }: CommentRowProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: qk.projectComments(projectId) });

  useEffect(() => {
    if (!showMenu) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setShowMenu(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [showMenu]);

  const resolveMutation = useMutation({
    mutationFn: () =>
      boardApi.updateComment(comment.id, {
        status: comment.status === "resolved" ? "todo" : "resolved",
      }),
    onSuccess: invalidate,
  });

  const setStatusMutation = useMutation({
    mutationFn: (status: CommentStatus) => boardApi.updateComment(comment.id, { status }),
    onSuccess: invalidate,
  });

  const deleteThreadMutation = useMutation({
    mutationFn: () => boardApi.deleteThread(comment.id),
    onSuccess: invalidate,
  });

  const meta = STATUS_META[comment.status];

  return (
    <div
      onClick={() => onNavigate(comment.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onNavigate(comment.id);
      }}
      title="Jump to this comment on the page"
      className="border-black/8 flex cursor-pointer flex-col gap-2 rounded-lg border bg-white p-3 text-left dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold text-white ${meta.dot}`}
            title={meta.label}
          >
            {sequenceNumber}
          </span>
          <Avatar name={comment.author_name} size={26} />
          <div>
            <span className="text-sm font-semibold">{comment.author_name}</span>{" "}
            <span className="text-text-muted text-xs">{timeAgo(comment.created_at)}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-text-muted" title="Desktop capture">
            <MonitorIcon width={14} height={14} />
          </span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              resolveMutation.mutate();
            }}
            disabled={resolveMutation.isPending}
            aria-pressed={comment.status === "resolved"}
            aria-label={comment.status === "resolved" ? "Mark as unresolved" : "Mark as resolved"}
            title={comment.status === "resolved" ? "Resolved" : "Mark as resolved"}
            className={`flex h-6 w-6 items-center justify-center rounded-full border ${
              comment.status === "resolved"
                ? "border-status-resolved bg-status-resolved text-white"
                : "border-black/15 text-text-muted dark:border-white/15"
            }`}
          >
            <svg viewBox="0 0 16 16" width="10" height="10" fill="none" aria-hidden="true">
              <path
                d="M3 8.5 6.5 12 13 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <div className="relative" ref={menuRef} onClick={(event) => event.stopPropagation()}>
            <button
              onClick={() => setShowMenu((prev) => !prev)}
              aria-label="Comment options"
              aria-haspopup="true"
              className="text-text-muted flex h-6 w-6 items-center justify-center rounded-md hover:bg-black/5 dark:hover:bg-white/10"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                <circle cx="3" cy="8" r="1.3" />
                <circle cx="8" cy="8" r="1.3" />
                <circle cx="13" cy="8" r="1.3" />
              </svg>
            </button>
            {showMenu && (
              <div className="bg-bg-surface absolute top-7 right-0 z-10 w-44 rounded-md border border-black/10 py-1 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
                <div className="text-text-muted px-3 pt-1 pb-0.5 text-[10px] font-semibold tracking-wide uppercase">
                  Move to
                </div>
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setShowMenu(false);
                      setStatusMutation.mutate(status);
                    }}
                    disabled={status === comment.status}
                    className="hover:bg-bg-canvas flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm disabled:opacity-40"
                  >
                    <span className={`h-2 w-2 rounded-full ${STATUS_META[status].dot}`} />
                    {STATUS_META[status].label}
                  </button>
                ))}
                <div className="my-1 border-t border-black/10 dark:border-white/10" />
                <button
                  onClick={() => {
                    setShowMenu(false);
                    deleteThreadMutation.mutate();
                  }}
                  className="text-recovery-orphaned hover:bg-bg-canvas block w-full px-3 py-1.5 text-left text-sm"
                >
                  Delete thread
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="text-sm">{comment.body}</p>
      {comment.attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {comment.attachments.map((attachment) => (
            <a
              key={attachment.url}
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="bg-bg-canvas flex max-w-[160px] items-center gap-1.5 rounded-md border border-black/10 px-2 py-1 text-xs dark:border-white/10"
              title={attachment.filename}
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true" className="text-text-muted shrink-0">
                <path
                  d="M11.5 5.5 6.8 10.2a2 2 0 1 1-2.8-2.8l5-5a3 3 0 1 1 4.2 4.2l-5.2 5.2a1 1 0 1 1-1.4-1.4L11 5.9"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="truncate">{attachment.filename}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
