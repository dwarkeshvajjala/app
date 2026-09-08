import type { QueryClient } from "@tanstack/react-query";

// Central React Query key factory (14-State-Management.md §14.2). Extended per feature module
// as endpoints land - never construct ad-hoc key arrays in components.
export const qk = {
  health: () => ["health"] as const,
  workspaces: () => ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (workspaceId: string | undefined) => ["workspace", workspaceId, "members"] as const,
  projects: (id: string) => ["workspace", id, "projects"] as const,
  clients: (id: string) => ["workspace", id, "clients"] as const,
  dashboard: (id: string) => ["workspace", id, "dashboard"] as const,
  search: (id: string, query: string) => ["workspace", id, "search", query] as const,
  tickets: (id: string) => ["workspace", id, "tickets"] as const,
  activity: (id: string) => ["workspace", id, "activity"] as const,
  integrations: (workspaceId: string) => ["workspace", workspaceId, "integrations"] as const,
  project: (projectId: string) => ["project", projectId] as const,
  projectPages: (projectId: string) => ["project", projectId, "pages"] as const,
  projectComments: (projectId: string) => ["project", projectId, "comments"] as const,
  projectRevisions: (projectId: string) => ["project", projectId, "revisions"] as const,
  shareLinks: (projectId: string) => ["project", projectId, "share-links"] as const,
  hardDeletePreview: (projectId: string) => ["project", projectId, "hard-delete-preview"] as const,
  // Broad, deliberately over-inclusive prefix - invalidates every "workspace"-rooted
  // query (dashboard, members, projects, tickets, activity, ...) at once. Existing
  // behavior preserved as-is when centralizing ad-hoc keys; not a new invalidation.
  workspaceAll: () => ["workspace"] as const,
  assets: (projectId: string) => ["assets", projectId] as const,
  assetComments: (pageId: string | undefined) => ["asset-comments", pageId] as const,
  review: (shareToken: string) => ["review", shareToken] as const,
  guestBoard: (projectId: string, guestToken: string) => ["guest-board", projectId, guestToken] as const,
  notificationsUnread: () => ["notifications", "unread-count"] as const,
  notificationsList: () => ["notifications", "list"] as const,
};

// A single ticket status/reply/priority change only ever affects the ticket list
// and the sidebar's per-status dashboard counts (FE-01/FE-02) - it does NOT need to
// invalidate members/projects/clients/activity/integrations too, which
// `cache.invalidateQueries({ queryKey: qk.workspace(id) })` (a broad prefix match)
// was doing on every single-ticket edit before this helper existed.
export function invalidateTicketsAndDashboard(cache: QueryClient, workspaceId: string) {
  return Promise.all([
    cache.invalidateQueries({ queryKey: qk.tickets(workspaceId) }),
    cache.invalidateQueries({ queryKey: qk.dashboard(workspaceId) }),
  ]);
}
