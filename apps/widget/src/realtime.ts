import type { ThreadManager } from "./thread-manager";
import { showToast, showOfflineIndicator } from "./ui";
import { connectReviewSocket } from "./ws-client";

// FE-05: hand-kept copy of @backline/ui's STATUS_LABELS (packages/ui/src/workflow.ts)
// - the widget deliberately never depends on any @backline/* package (bundle-size/
// isolation boundary, same reasoning as this file's own time.ts). Keep this text in
// sync with that file by hand if either changes.
export const STATUS_LABELS: Record<string, string> = {
  todo: "Not started",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

// Realtime signal (12-API-WebSocket.md §12.6): presence is announced just by
// connecting with this page's id. comment.updated is only surfaced for a comment
// *this guest created* (a status change on a comment the guest can't act on isn't
// worth interrupting them for). comment.deleted keeps this page's thread state -
// pins, and any currently-open thread panel - in sync with deletes made elsewhere
// (another tab, or the same delete cascading from a "delete thread" call).
export function wireRealtimeUpdates(
  shadow: ShadowRoot,
  apiBaseUrl: string | undefined,
  guestSessionToken: string,
  pageId: string,
  threadManager: ThreadManager,
  ownCommentIds: Set<string>,
): void {
  let indicator: { dismiss: () => void, setStatus: (status: string) => void } | null = null;
  connectReviewSocket(
    apiBaseUrl ?? "http://localhost:8000",
    guestSessionToken,
    pageId,
    (type, payload) => {
      if (type === "comment.updated") {
        if (!payload?.id || !ownCommentIds.has(payload.id)) return;
        const label = STATUS_LABELS[payload.status] ?? payload.status;
        showToast(shadow, `Your comment was updated: ${label}`);
        return;
      }

      if (type === "comment.deleted") {
        const commentId: string | undefined = payload?.comment_id;
        if (!commentId) return;
        const parentId: string | null | undefined = payload?.parent_id;
        const topId = parentId ?? commentId;
        threadManager.handleCommentDeleted(commentId, topId);
      }
    },
    (status) => {
      if (status === "connected") {
        if (indicator) {
          indicator.dismiss();
          indicator = null;
        }
      } else if (status === "offline") {
        if (!indicator) indicator = showOfflineIndicator(shadow);
        indicator.setStatus("You are offline. Trying to reconnect...");
      } else if (status === "connecting") {
        if (!indicator) indicator = showOfflineIndicator(shadow);
        indicator.setStatus("Connection lost. Trying to reconnect...");
      }
    },
  );
}
