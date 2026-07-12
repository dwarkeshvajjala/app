import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useWSEvent } from "../../app/WSProvider";
import { useAuth } from "../auth/AuthContext";
import * as notificationsApi from "./api";
import type { NotificationOut } from "./api";

const UNREAD_COUNT_KEY = ["notifications", "unread-count"];
const LIST_KEY = ["notifications", "list"];

function describe(notification: NotificationOut): string {
  const payload = notification.payload as { integration_type?: string };
  switch (notification.type) {
    case "comment_assigned":
      return "You were assigned a comment";
    case "integration_disconnected":
      return `Your ${payload.integration_type ?? ""} integration was disconnected after repeated delivery failures`;
    default:
      return "New notification";
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

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

  async function handleMarkRead(id: string) {
    await notificationsApi.markRead(id);
    invalidate();
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    invalidate();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Notifications"
      >
        🔔
        {!!unread && unread > 0 && (
          <span className="bg-recovery-orphaned absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="bg-bg-surface absolute right-0 z-10 mt-2 w-80 rounded-md border border-black/10 shadow-lg dark:border-white/10">
          <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 dark:border-white/10">
            <span className="text-sm font-medium">Notifications</span>
            <button
              onClick={handleMarkAllRead}
              className="text-text-muted text-xs underline"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {(notifications ?? []).length === 0 && (
              <li className="text-text-muted p-3 text-sm">No notifications yet.</li>
            )}
            {(notifications ?? []).map((notification) => (
              <li
                key={notification.id}
                className={`cursor-pointer border-b border-black/5 px-3 py-2 text-sm last:border-0 dark:border-white/5 ${
                  notification.read_at ? "text-text-muted" : "font-medium"
                }`}
                onClick={() => !notification.read_at && handleMarkRead(notification.id)}
              >
                {describe(notification)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
