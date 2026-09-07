import type { Schemas } from "@backline/types";

// FE-05: WORKFLOW_STATUSES/STATUS_LABELS/STATUS_COLORS are defined once, in
// @backline/ui (packages/ui/src/workflow.ts), and re-exported here so this
// module's many existing call sites (AssetReview, TicketsPage, BoardPage, ...)
// don't all need their import path changed. TAGS/isClosed are app-only concerns,
// not part of that duplication, and stay defined here.
export { WORKFLOW_STATUSES, STATUS_LABELS, STATUS_COLORS } from "@backline/ui";
export type { WorkflowStatus } from "@backline/ui";

export const TAGS: NonNullable<Schemas["CommentUpdate"]["tags"]> = ["Bug", "Copy", "Design", "Responsive", "Content", "Accessibility"];
export function isClosed(status: Schemas["CommentOut"]["status"]) { return status === "resolved" || status === "wont_fix"; }
