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

// audit-batch-13 P2: these used to be a second, independently-drifted palette -
// 3 of 4 compared statuses disagreed with tailwind.config.js's `status-*` tokens
// (only wont_fix matched by coincidence), producing a visible on-screen collision
// where the same status rendered two different colors in the same view (e.g.
// AssetReview.tsx's pin markers via STATUS_COLORS next to StatusBadge's badge for
// the same comment). Reconciled to tailwind.config.js's values, since those are
// already WCAG-audited (see that file's own comments) - this is now the only
// place a color literal for these statuses should live outside that config.
export const STATUS_COLORS: Record<WorkflowStatus, string> = {
  todo: "#94A3B8",
  in_progress: "#F59E0B",
  in_review: "#396586",
  blocked: "#A33D1F",
  resolved: "#22C55E",
  wont_fix: "#64748B",
};
