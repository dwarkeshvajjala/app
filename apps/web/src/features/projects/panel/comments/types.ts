import type { CommentStatus } from "../../../board/api";

export type LayerFilter = "all" | "client" | "team";
export type SortOrder = "newest" | "oldest";

export const STATUS_ORDER: CommentStatus[] = ["todo", "in_progress", "in_review", "blocked", "resolved", "wont_fix"];

export const STATUS_META: Record<
  CommentStatus,
  { label: string; dot: string; fill: string; border: string }
> = {
  in_review: { label: "In review", dot: "bg-status-in-review", fill: "bg-status-in-review/10 text-status-in-review", border: "border-status-in-review/40" },
  blocked: { label: "Blocked", dot: "bg-status-blocked", fill: "bg-status-blocked/10 text-status-blocked", border: "border-status-blocked/40" },
  todo: {
    // FE-05: matches @backline/ui's STATUS_LABELS (packages/ui/src/workflow.ts) -
    // this was "Active" here, "To do" in Badge.tsx/BoardPage/widget, 3 different
    // words for the same status.
    label: "Not started",
    dot: "bg-status-todo",
    fill: "bg-status-todo/10 text-slate-600 dark:text-slate-300",
    border: "border-status-todo/40",
  },
  in_progress: {
    label: "In progress",
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
    label: "Won't fix",
    dot: "bg-status-wont-fix",
    fill: "bg-status-wont-fix/10 text-slate-600 dark:text-slate-300",
    border: "border-status-wont-fix/40",
  },
};
