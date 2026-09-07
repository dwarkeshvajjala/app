import { StatusBadge } from "@backline/ui";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@backline/ui";

import { qk } from "../../lib/query-keys";
import * as reviewApi from "./api";

// FD-AUD-042/M-04 "show ticket board to client" - a read-only, client-safe list.
// Only reachable when the project's show_board_to_client setting is on; the
// endpoint independently re-checks that server-side regardless of how this
// screen was reached (comments/service.py::list_guest_board).
export function GuestBoard({
  projectId,
  guestToken,
  onBack,
  continueLabel,
  onContinue,
}: {
  projectId: string;
  guestToken: string;
  onBack: () => void;
  continueLabel?: string;
  onContinue?: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: qk.guestBoard(projectId, guestToken),
    queryFn: () => reviewApi.getGuestBoard(projectId, guestToken),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-4 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Board</h1>
        <button onClick={onBack} className="text-text-muted text-sm underline">
          Back
        </button>
      </div>

      {isLoading && <p className="text-text-muted text-sm">Loading...</p>}
      {error && <p className="text-recovery-orphaned text-sm">Could not load the board.</p>}

      {data && data.items.length === 0 && (
        <p className="text-text-muted text-sm">No items yet.</p>
      )}

      {data && data.items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-md border border-black/10 p-3 dark:border-white/10"
            >
              <p className="text-sm">{item.body}</p>
              <div className="text-text-muted flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status={item.status} />
                {item.due_at && <span>Due {new Date(item.due_at).toLocaleDateString()}</span>}
                {item.assignee_names && item.assignee_names.length > 0 && (
                  <span>{item.assignee_names.join(", ")}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {onContinue && (
        <Button onClick={onContinue} className="mt-auto">
          {continueLabel ?? "Continue to site"}
        </Button>
      )}
    </main>
  );
}
