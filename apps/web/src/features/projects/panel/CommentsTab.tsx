import { Avatar } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import * as boardApi from "../../board/api";
import type { CommentOut, CommentStatus } from "../../board/api";
import { API_BASE_URL } from "../../../lib/api-client";
import { qk } from "../../../lib/query-keys";
import { timeAgo } from "../../../lib/time";
import { FilterIcon, MonitorIcon, SortIcon } from "./icons";

const STATUS_ORDER: CommentStatus[] = ["todo", "in_progress", "resolved", "wont_fix"];

const STATUS_META: Record<
  CommentStatus,
  { label: string; dot: string; fill: string; border: string }
> = {
  todo: {
    label: "Active",
    dot: "bg-status-todo",
    fill: "bg-status-todo/10 text-slate-600 dark:text-slate-300",
    border: "border-status-todo/40",
  },
  in_progress: {
    label: "In Progress",
    dot: "bg-status-in-progress",
    fill: "bg-status-in-progress/10 text-amber-700 dark:text-amber-300",
    border: "border-status-in-progress/40",
  },
  resolved: {
    label: "Resolved",
    dot: "bg-status-resolved",
    fill: "bg-status-resolved/10 text-emerald-700 dark:text-emerald-300",
    border: "border-status-resolved/40",
  },
  wont_fix: {
    label: "Won't Fix",
    dot: "bg-status-wont-fix",
    fill: "bg-status-wont-fix/10 text-slate-600 dark:text-slate-300",
    border: "border-status-wont-fix/40",
  },
};

type LayerFilter = "all" | "client" | "team";
type SortOrder = "newest" | "oldest";

interface CommentRowProps {
  comment: CommentOut;
  projectId: string;
  sequenceNumber: number;
  onNavigate: (commentId: string) => void;
}

function CommentRow({ comment, projectId, sequenceNumber, onNavigate }: CommentRowProps) {
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

interface CommentsTabProps {
  projectId: string;
  canvasRef: RefObject<HTMLIFrameElement | null>;
  currentPageId: string | null;
}

export function CommentsTab({ projectId, canvasRef, currentPageId }: CommentsTabProps) {
  const { data: comments, isLoading } = useQuery({
    queryKey: qk.projectComments(projectId),
    queryFn: () => boardApi.listProjectComments(projectId),
  });

  // null = show every status (the initial state) - clicking a chip isolates the list
  // down to just that one status, clicking it again (or "Select all") goes back to
  // showing everything. Not a multi-select toggle: with 4 statuses, "tap one to see just
  // that bucket" is the more useful click for triaging than gradually excluding buckets.
  const [activeStatus, setActiveStatus] = useState<CommentStatus | null>(null);
  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [currentPageOnly, setCurrentPageOnly] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const allThreads = (comments ?? []).filter((c) => !c.parent_id);

  // Numeric badge order is stable across every filter/sort choice - it always reflects
  // creation order across the whole project, not the currently-visible subset - so a
  // comment's number never changes just because a filter hid its neighbors.
  const sequenceByCommentId = useMemo(() => {
    const byCreatedAsc = allThreads
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const map = new Map<string, number>();
    byCreatedAsc.forEach((c, index) => map.set(c.id, index + 1));
    return map;
  }, [allThreads]);

  const statusCounts = useMemo(() => {
    const counts: Record<CommentStatus, number> = {
      todo: 0,
      in_progress: 0,
      resolved: 0,
      wont_fix: 0,
    };
    for (const c of allThreads) counts[c.status] += 1;
    return counts;
  }, [allThreads]);

  const filteredThreads = allThreads.filter((c) => {
    if (activeStatus && c.status !== activeStatus) return false;
    if (layerFilter !== "all" && c.layer !== layerFilter) return false;
    if (currentPageOnly && c.page_id !== currentPageId) return false;
    return true;
  });

  const sortedThreads = useMemo(
    () =>
      filteredThreads
        .slice()
        .sort((a, b) =>
          sortOrder === "newest"
            ? b.created_at.localeCompare(a.created_at)
            : a.created_at.localeCompare(b.created_at),
        ),
    [filteredThreads, sortOrder],
  );

  function onStatusChipClick(status: CommentStatus) {
    setActiveStatus((prev) => (prev === status ? null : status));
  }

  // The canvas iframe is served from the API's own origin (proxy mode), not the
  // dashboard's - postMessage is the only way to reach into it (apps/widget/src/index.ts
  // listens for this exact message). Not just cosmetic: a comment whose pin never
  // rendered (off-screen, or the target hadn't loaded yet) can still genuinely exist -
  // this is how a reviewer actually finds it again.
  function navigateToComment(commentId: string) {
    canvasRef.current?.contentWindow?.postMessage(
      { type: "backline:scroll-to-comment", commentId },
      new URL(API_BASE_URL).origin,
    );
  }

  const layerLabel: Record<LayerFilter, string> = {
    all: "All comments",
    client: "Client-visible only",
    team: "Team-only",
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Comments ({filteredThreads.length}
          {filteredThreads.length !== allThreads.length ? ` of ${allThreads.length}` : ""})
        </h3>
        <button
          onClick={() => setActiveStatus(null)}
          className="text-accent-primary text-xs font-medium hover:underline"
        >
          Select all
        </button>
      </div>

      <div className="text-text-muted text-[10px] font-semibold tracking-wide uppercase">
        Status
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          const isActive = activeStatus === status;
          const isShown = activeStatus === null || isActive;
          return (
            <button
              key={status}
              onClick={() => onStatusChipClick(status)}
              aria-pressed={isShown}
              data-active={isActive}
              className={`flex items-center justify-between gap-2 rounded-lg border-2 px-2.5 py-2 text-xs font-medium ${meta.fill} ${
                isActive ? "border-text-primary dark:border-white" : meta.border
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span>{statusCounts[status]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-b border-black/10 pb-3 dark:border-white/10">
        <div className="relative" ref={sortMenuRef}>
          <button
            onClick={() => {
              setShowSortMenu((prev) => !prev);
              setShowFilterMenu(false);
            }}
            className="border-black/8 text-text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            <SortIcon width={13} height={13} />
            Sort
          </button>
          {showSortMenu && (
            <div className="bg-bg-surface absolute top-8 left-0 z-10 w-40 rounded-md border border-black/10 py-1 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
              {(["newest", "oldest"] as SortOrder[]).map((order) => (
                <button
                  key={order}
                  onClick={() => {
                    setSortOrder(order);
                    setShowSortMenu(false);
                  }}
                  className={`hover:bg-bg-canvas block w-full px-3 py-1.5 text-left text-sm ${
                    sortOrder === order ? "text-accent-primary font-medium" : ""
                  }`}
                >
                  {order === "newest" ? "Newest first" : "Oldest first"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={filterMenuRef}>
          <button
            onClick={() => {
              setShowFilterMenu((prev) => !prev);
              setShowSortMenu(false);
            }}
            className="border-black/8 text-text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
          >
            <FilterIcon width={13} height={13} />
            Filter
          </button>
          {showFilterMenu && (
            <div className="bg-bg-surface absolute top-8 left-0 z-10 w-48 rounded-md border border-black/10 py-1 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
              {(["all", "client", "team"] as LayerFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setLayerFilter(filter);
                    setShowFilterMenu(false);
                  }}
                  className={`hover:bg-bg-canvas block w-full px-3 py-1.5 text-left text-sm ${
                    layerFilter === filter ? "text-accent-primary font-medium" : ""
                  }`}
                >
                  {layerLabel[filter]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <label
        className={`flex items-center gap-2 text-xs ${
          currentPageId ? "text-text-primary" : "text-text-muted"
        }`}
        title={currentPageId ? undefined : "Load a page in the canvas first"}
      >
        <input
          type="checkbox"
          checked={currentPageOnly}
          disabled={!currentPageId}
          onChange={(event) => setCurrentPageOnly(event.target.checked)}
        />
        Show comments on current page only
      </label>

      {isLoading && <p className="text-text-muted text-sm">Loading...</p>}
      {!isLoading && allThreads.length === 0 && (
        <p className="text-text-muted text-sm">No comments on this project yet.</p>
      )}
      {!isLoading && allThreads.length > 0 && filteredThreads.length === 0 && (
        <p className="text-text-muted text-sm">No comments match the current filters.</p>
      )}

      <div className="flex flex-col gap-2">
        {sortedThreads.map((comment) => (
          <CommentRow
            key={comment.id}
            comment={comment}
            projectId={projectId}
            sequenceNumber={sequenceByCommentId.get(comment.id) ?? 0}
            onNavigate={navigateToComment}
          />
        ))}
      </div>
    </div>
  );
}
