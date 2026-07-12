// Central React Query key factory (14-State-Management.md §14.2). Extended per feature module
// as endpoints land - never construct ad-hoc key arrays in components.
export const qk = {
  health: () => ["health"] as const,
};
