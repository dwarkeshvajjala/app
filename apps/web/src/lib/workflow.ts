import type { Schemas } from "@backline/types";

export type WorkflowStatus = Schemas["CommentOut"]["status"];
export const WORKFLOW_STATUSES: WorkflowStatus[] = ["todo", "in_progress", "in_review", "blocked", "resolved", "wont_fix"];
export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  todo: "Not started", in_progress: "In progress", in_review: "In review",
  blocked: "Blocked", resolved: "Resolved", wont_fix: "Won't fix",
};
export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  todo: "#9A9D99", in_progress: "#E8B833", in_review: "#5B7FA6",
  blocked: "#C2542E", resolved: "#69DEB2", wont_fix: "#64748B",
};
export const TAGS: NonNullable<Schemas["CommentUpdate"]["tags"]> = ["Bug", "Copy", "Design", "Responsive", "Content", "Accessibility"];
export function isClosed(status: WorkflowStatus) { return status === "resolved" || status === "wont_fix"; }
