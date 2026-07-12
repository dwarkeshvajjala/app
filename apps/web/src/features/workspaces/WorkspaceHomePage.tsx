import { useOutletContext } from "react-router-dom";

import type { WorkspaceOut } from "./api";

export function WorkspaceHomePage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-xl font-semibold">{workspace.name}</h1>
      <p className="text-text-muted mt-2 text-sm">
        Projects, share links, and the review board land in Milestone 2 onward. For now, this
        confirms auth + workspace context resolved correctly end to end.
      </p>
    </main>
  );
}
