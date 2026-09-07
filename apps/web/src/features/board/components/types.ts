import type { CommentOut } from "../api";

export const CONNECTION_LABEL: Record<string, string> = {
  connected: "Live",
  connecting: "Connecting...",
  reconnecting: "Reconnecting...",
  disconnected: "Offline",
};

export const CONNECTION_DOT: Record<string, string> = {
  connected: "bg-status-resolved",
  connecting: "bg-status-in-progress",
  reconnecting: "bg-status-in-progress",
  disconnected: "bg-status-wont-fix",
};

export function commentContext(comment: CommentOut): { device_type?: string; url?: string } {
  return comment.context as { device_type?: string; url?: string };
}

export interface Filters {
  status: string;
  layer: string;
  assignee: string;
  device: string;
  page: string;
}

export function filtersFromParams(params: URLSearchParams): Filters {
  return {
    status: params.get("status") ?? "",
    layer: params.get("layer") ?? "",
    assignee: params.get("assignee") ?? "",
    device: params.get("device") ?? "",
    page: params.get("page") ?? "",
  };
}
