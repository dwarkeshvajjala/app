import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";

import { AuthProvider } from "../features/auth/AuthContext";
import { WSProvider } from "./WSProvider";

// WorkspaceProvider (beyond auth's own workspace_id/role) / PermissionProvider still
// land in a later milestone (05-Frontend-Architecture.md §5.4) - WSProvider needs
// AuthProvider's workspaceId, so it nests inside it.
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 2,
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WSProvider>{children}</WSProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
