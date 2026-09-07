import { Button } from "@backline/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useAuth } from "../auth/AuthContext";
import { qk } from "../../lib/query-keys";
import { useDocumentTitle } from "../../lib/use-document-title";
import * as workspacesApi from "./api";
import type { TranslationKeys } from "../../lib/i18n";

export function WorkspacePickerPage() {
  const { t } = useTranslation();
  const { switchWorkspace, logout, user } = useAuth();
  useDocumentTitle(t('workspacePicker.title' as TranslationKeys));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: workspaces, isLoading } = useQuery({
    queryKey: qk.workspaces(),
    queryFn: workspacesApi.listWorkspaces,
  });

  async function enterWorkspace(workspaceId: string, slug: string) {
    setError(null);
    try {
      await switchWorkspace(workspaceId);
      navigate(`/w/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open that workspace.");
    }
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const workspace = await workspacesApi.createWorkspace(newWorkspaceName);
      await queryClient.invalidateQueries({ queryKey: qk.workspaces() });
      await enterWorkspace(workspace.id, workspace.slug);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create workspace.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t('workspacePicker.title' as TranslationKeys)}</h1>
        <button className="text-text-muted text-xs underline" onClick={() => logout()}>
          {t('account.signOut' as TranslationKeys)}
        </button>
      </div>
      {user && <p className="text-text-muted text-sm">Signed in as {user.email}</p>}

      {isLoading && <p className="text-text-muted text-sm">Loading...</p>}

      {workspaces && workspaces.length > 0 && (
        <ul className="flex flex-col gap-2">
          {workspaces.map((ws) => (
            <li key={ws.id}>
              <button
                className="hover:bg-bg-canvas flex w-full items-center justify-between rounded-md border border-black/10 px-4 py-3 text-left transition-colors dark:border-white/10"
                onClick={() => enterWorkspace(ws.id, ws.slug)}
              >
                <span className="font-medium">{ws.name}</span>
                <span className="text-text-muted text-sm">{t('workspacePicker.select' as TranslationKeys)} &rarr;</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {workspaces && workspaces.length === 0 && (
        <p className="text-text-muted text-sm">
          You don't belong to any workspaces yet - create one below.
        </p>
      )}

      <form className="mt-8 flex flex-col gap-3" onSubmit={handleCreate}>
        <h2 className="text-sm font-medium">{t('workspacePicker.newWorkspace' as TranslationKeys)}</h2>
        <input
          type="text"
          required
          placeholder="Acme Corp"
          value={newWorkspaceName}
          onChange={(event) => setNewWorkspaceName(event.target.value)}
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
        {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {t('workspacePicker.newWorkspace' as TranslationKeys)}
        </Button>
      </form>
    </main>
  );
}
