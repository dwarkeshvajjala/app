import type { Schemas } from "@backline/types";

// FE-05: single source of truth for comment/ticket workflow status labels and
// colors. apps/web/src/lib/workflow.ts re-exports these (rather than every
// consumer importing from here directly) so its many existing call sites don't
// need to change import paths. apps/widget is the one deliberate exception - it
// never depends on any @backline/* package (bundle-size/isolation boundary, see
// apps/widget/src/types.ts's own comment) and hand-keeps a copy instead; keep that
// copy's label text in sync with STATUS_LABELS below by hand.
export type WorkflowStatus = Schemas["CommentOut"]["status"];

export const WORKFLOW_STATUSES: WorkflowStatus[] = [
  "todo",
  "in_progress",
  "in_review",
  "blocked",
  "resolved",
  "wont_fix",
];

export const STATUS_LABELS: Record<WorkflowStatus, string> = {
  todo: "Not started",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  todo: "#9A9D99",
  in_progress: "#E8B833",
  in_review: "#5B7FA6",
  blocked: "#C2542E",
  resolved: "#69DEB2",
  wont_fix: "#64748B",
};
