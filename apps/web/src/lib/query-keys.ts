// Central React Query key factory (14-State-Management.md §14.2). Extended per feature module
// as endpoints land - never construct ad-hoc key arrays in components.
export const qk = {
  health: () => ["health"] as const,
  workspaces: () => ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  members: (workspaceId: string) => ["workspace", workspaceId, "members"] as const,
  projects: (id: string) => ["workspace", id, "projects"] as const,
  clients: (id: string) => ["workspace", id, "clients"] as const,
  dashboard: (id: string) => ["workspace", id, "dashboard"] as const,
  search: (id: string, query: string) => ["workspace", id, "search", query] as const,
  tickets: (id: string) => ["workspace", id, "tickets"] as const,
  activity: (id: string) => ["workspace", id, "activity"] as const,
  projectComments: (projectId: string) => ["project", projectId, "comments"] as const,
};
