import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type NotificationOut = Schemas["NotificationOut"];

export function listNotifications(before?: string): Promise<NotificationOut[]> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiFetch<NotificationOut[]>(`/api/v1/notifications${query}`);
}

export function unreadCount(): Promise<number> {
  return apiFetch<number>("/api/v1/notifications/unread-count");
}

export function markRead(notificationId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH" });
}

export function markAllRead(): Promise<void> {
  return apiFetch<void>("/api/v1/notifications/mark-all-read", { method: "POST" });
}
