import { Button } from "@backline/ui";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api-client";
import { qk } from "../lib/query-keys";

interface HealthResponse {
  status: string;
  mongo: string;
  redis: string;
}

export function HomePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qk.health(),
    queryFn: () => apiFetch<HealthResponse>("/health"),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-3xl font-semibold">Backline</h1>
      <p className="text-text-muted text-sm">
        Milestone 0: monorepo scaffold. Dashboard shell, auth, and real screens land starting
        Milestone 1.
      </p>

      <div className="bg-bg-surface w-full rounded-md border border-black/10 p-4 text-left text-sm dark:border-white/10">
        <p className="font-medium">Backend connectivity</p>
        {isLoading && <p className="text-text-muted">Checking /health...</p>}
        {isError && <p className="text-recovery-orphaned">Could not reach the API.</p>}
        {data && (
          <ul className="mt-2 space-y-1">
            <li>API: {data.status}</li>
            <li>MongoDB: {data.mongo}</li>
            <li>Redis: {data.redis}</li>
          </ul>
        )}
      </div>

      <Button onClick={() => refetch()}>Re-check health</Button>
    </main>
  );
}
