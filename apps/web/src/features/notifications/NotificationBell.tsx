import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useWSEvent } from "../../app/WSProvider";
import { useAuth } from "../auth/AuthContext";
import * as notificationsApi from "./api";
import type { NotificationOut } from "./api";

const UNREAD_COUNT_KEY = ["notifications", "unread-count"];
const LIST_KEY = ["notifications", "list"];

// Map notification types to human-readable descriptions (FD-AUD-006)
function describe(notification: NotificationOut): string {
  const payload = notification.payload as Record<string, string>;
  const type = notification.type as string;
  switch (type) {
    case "comment_assigned":
      return "You were assigned a comment";
    case "comment_reply":
      return `${payload.actor_name || "Someone"} replied to a comment`;
    case "comment_mention":
      return `${payload.actor_name || "Someone"} mentioned you in a comment`;
    case "comment_status_changed":
      return `A comment was marked ${payload.new_status || "updated"}`;
    case "share_link_created":
      return "A new share link was created for a project";
    case "integration_disconnected":
      return `Your ${payload.integration_type ?? ""} integration was disconnected after repeated delivery failures`;
    case "deploy_recovery_completed":
      return "Comment anchors were re-mapped after a deploy";
    default:
      return "New notification";
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: unread } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: notificationsApi.unreadCount,
    staleTime: 30_000,
  });

  const { data: notifications } = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => notificationsApi.listNotifications(),
    enabled: open,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    queryClient.invalidateQueries({ queryKey: LIST_KEY });
  }, [queryClient]);

  useWSEvent(
    "notification.new",
    useCallback(
      (payload: { recipient_user_id: string }) => {
        if (payload.recipient_user_id === user?.id) invalidate();
      },
      [user?.id, invalidate],
    ),
  );

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    invalidate();
  }

  async function handleClickNotification(notification: NotificationOut) {
    // Mark as read then navigate to target_route if provided
    if (!notification.read_at) {
      await notificationsApi.markRead(notification.id);
      invalidate();
    }
    const route = (notification as NotificationOut & { target_route?: string }).target_route;
    if (route) {
      setOpen(false);
      navigate(route);
    }
  }

  // Close on outside click
  function handleToggle() {
    setOpen((v) => !v);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={handleToggle}
        className="relative rounded-md p-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        aria-label={`Notifications${unread && unread > 0 ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        🔔
        {!!unread && unread > 0 && (
          <span className="bg-recovery-orphaned absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop for outside-click close */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 9 }}
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            className="bg-bg-surface absolute right-0 z-10 mt-2 w-80 rounded-md border border-black/10 shadow-lg dark:border-white/10"
            style={{ zIndex: 10 }}
            role="dialog"
            aria-label="Notifications"
          >
            <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 dark:border-white/10">
              <span className="text-sm font-medium">Notifications</span>
              <button
                onClick={handleMarkAllRead}
                className="text-text-muted text-xs underline"
              >
                Mark all read
              </button>
            </div>
            <ul className="max-h-80 overflow-y-auto" role="list">
              {(notifications ?? []).length === 0 && (
                <li className="text-text-muted p-3 text-sm">No notifications yet.</li>
              )}
              {(notifications ?? []).map((notification) => {
                const route = (notification as NotificationOut & { target_route?: string }).target_route;
                return (
                  <li
                    key={notification.id}
                    className={[
                      "bl-notif-item border-b border-black/5 px-3 py-2.5 text-sm last:border-0 dark:border-white/5",
                      !notification.read_at ? "unread" : "text-text-muted",
                    ].join(" ")}
                    onClick={() => handleClickNotification(notification)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void handleClickNotification(notification);
                      }
                    }}
                    aria-label={`${describe(notification)}${route ? " — click to view" : ""}`}
                  >
                    <div>{describe(notification)}</div>
                    {route && (
                      <span className="bl-notif-route">{route}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
