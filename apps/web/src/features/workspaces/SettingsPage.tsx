import { Avatar, Button } from "@backline/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { qk } from "../../lib/query-keys";
import { useDocumentTitle } from "../../lib/use-document-title";
import { useUnsavedChanges } from "../../lib/use-unsaved-changes";
import * as workspacesApi from "./api";
import type { WorkspaceOut } from "./api";

export function SettingsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  useDocumentTitle('Settings');
  const queryClient = useQueryClient();
  const [name, setName] = useState(workspace.name);
  
  const nameChanged = name.trim().length > 0 && name.trim() !== workspace.name;
  useUnsavedChanges(nameChanged);

  const renameMutation = useMutation({
    mutationFn: (newName: string) => workspacesApi.updateWorkspace(workspace.id, newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.workspaces() });
    },
  });

  return (
    <main className="px-6 py-8">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="mt-6 max-w-lg overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <div className="flex items-center gap-4 p-5">
          <Avatar name={workspace.name} size={56} />
          <div>
            <h2 className="text-sm font-semibold">Workspace Avatar</h2>
            <p className="text-text-muted mt-1 text-sm">This is your workspace avatar.</p>
            <p className="text-text-muted text-sm">Click on the avatar to upload a new image (max 5MB)</p>
          </div>
        </div>
        <div className="bg-bg-canvas flex items-center justify-between border-t border-black/10 px-5 py-3 dark:border-white/10">
          <p className="text-text-muted text-xs">
            Avatar uploads aren't available yet - coming soon.
          </p>
          <Button variant="secondary" disabled title="Not available yet" aria-label="Save workspace avatar">
            Save
          </Button>
        </div>
      </div>

      <div className="mt-6 max-w-lg overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <div className="p-5">
          <h2 className="text-sm font-semibold">Workspace Name</h2>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            Workspace Name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!name.trim()}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-500"
            />
          </label>
        </div>
        <div className="bg-bg-canvas flex items-center justify-between border-t border-black/10 px-5 py-3 dark:border-white/10">
          <p className="text-text-muted text-xs">This is your workspace's visible name within Backline.</p>
          <Button
            variant="secondary"
            aria-label="Save workspace name"
            disabled={!nameChanged || renameMutation.isPending}
            onClick={() => renameMutation.mutate(name.trim())}
          >
            Save
          </Button>
        </div>
        {renameMutation.isSuccess && (
          <p className="text-status-resolved px-5 pb-3 text-xs">Workspace name updated.</p>
        )}
        {renameMutation.isError && (
          <p className="text-recovery-orphaned px-5 pb-3 text-xs">Could not update workspace name.</p>
        )}
      </div>
    </main>
  );
}
