import { Button } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useOutletContext } from "react-router-dom";

import type { WorkspaceOut } from "../workspaces/api";
import * as integrationsApi from "./api";
import { buildClickUpAuthUrl } from "./clickup-oauth-url";

import clickupLogo from "../../assets/icons/clickup-svgrepo-com.svg";
import disconnectLogo from "../../assets/icons/disconnect-2-svgrepo-com.svg";
import slackLogo from "../../assets/icons/slack-svgrepo-com.svg";
import trelloLogo from "../../assets/icons/trello-color-svgrepo-com.svg";

const CLICKUP_PENDING_KEY = "backline:clickup-oauth-pending";

const TYPE_LABELS: Record<string, string> = {
  slack: "Slack",
  clickup: "ClickUp",
  trello: "Trello",
};

export function IntegrationsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["workspace", workspace.id, "integrations"];
  const { data: integrations, isLoading } = useQuery({
    queryKey,
    queryFn: () => integrationsApi.listIntegrations(workspace.id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
  const connectSlackMutation = useMutation({
    mutationFn: () =>
      integrationsApi.connectSlack(workspace.id, {
        webhookUrl: slackWebhookUrl,
        notifyStatusChanges: true,
        notifyTeamLayer: false,
      }),
    onSuccess: () => {
      setSlackWebhookUrl("");
      setError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not connect Slack."),
  });

  const [trelloApiKey, setTrelloApiKey] = useState("");
  const [trelloToken, setTrelloToken] = useState("");
  const [trelloListId, setTrelloListId] = useState("");
  const connectTrelloMutation = useMutation({
    mutationFn: () =>
      integrationsApi.connectTrello(workspace.id, {
        apiKey: trelloApiKey,
        token: trelloToken,
        listId: trelloListId,
      }),
    onSuccess: () => {
      setTrelloApiKey("");
      setTrelloToken("");
      setTrelloListId("");
      setError(null);
      invalidate();
    },
    onError: (err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not connect Trello."),
  });

  const [clickupListId, setClickupListId] = useState("");
  const disconnectMutation = useMutation({
    mutationFn: (integrationId: string) => integrationsApi.disconnectIntegration(integrationId),
    onSuccess: invalidate,
  });

  function handleConnectSlack(event: FormEvent) {
    event.preventDefault();
    connectSlackMutation.mutate();
  }

  function handleConnectTrello(event: FormEvent) {
    event.preventDefault();
    connectTrelloMutation.mutate();
  }

  function handleConnectClickUp(event: FormEvent) {
    event.preventDefault();
    sessionStorage.setItem(
      CLICKUP_PENDING_KEY,
      JSON.stringify({
        workspaceId: workspace.id,
        workspaceSlug: workspace.slug,
        listId: clickupListId,
      }),
    );
    window.location.href = buildClickUpAuthUrl();
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold">Integrations</h1>
      <p className="text-text-muted mt-1 text-sm">
        Connect Slack, ClickUp, or Trello (17-Notifications-Integrations.md).
      </p>

      {error && <p className="text-recovery-orphaned mt-4 text-sm">{error}</p>}

      {isLoading && <p className="text-text-muted mt-4 text-sm">Loading...</p>}

      {integrations && integrations.length > 0 && (
        <ul className="mt-6 flex flex-col gap-2">
          {integrations.map((integration) => (
            <li
              key={integration.id}
              className="flex items-center justify-between rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
            >
              <span className="text-sm font-medium">{TYPE_LABELS[integration.type]}</span>
              <button
                className="flex items-center gap-1 text-recovery-orphaned text-xs hover:underline"
                onClick={() => disconnectMutation.mutate(integration.id)}
              >
                <img src={disconnectLogo} alt="" className="h-4 w-4" />
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10"
        onSubmit={handleConnectSlack}
      >
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <img src={slackLogo} alt="" className="h-5 w-5" />
          Connect Slack
        </h2>
        <p className="text-text-muted text-xs">
          Paste an Incoming Webhook URL. Team-only comments never post here unless you've
          configured a private channel - double check before enabling that below.
        </p>
        <input
          required
          type="url"
          placeholder="https://hooks.slack.com/services/..."
          value={slackWebhookUrl}
          onChange={(event) => setSlackWebhookUrl(event.target.value)}
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <Button type="submit" disabled={connectSlackMutation.isPending}>
          Connect Slack
        </Button>
      </form>

      <form
        className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10"
        onSubmit={handleConnectTrello}
      >
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <img src={trelloLogo} alt="" className="h-5 w-5" />
          Connect Trello
        </h2>
        <p className="text-text-muted text-xs">
          Paste your personal API key + token from Trello's token generation page, and the
          list ID new cards should be created in.
        </p>
        <input
          required
          placeholder="API key"
          value={trelloApiKey}
          onChange={(event) => setTrelloApiKey(event.target.value)}
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <input
          required
          placeholder="Token"
          value={trelloToken}
          onChange={(event) => setTrelloToken(event.target.value)}
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <input
          required
          placeholder="List ID"
          value={trelloListId}
          onChange={(event) => setTrelloListId(event.target.value)}
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <Button type="submit" disabled={connectTrelloMutation.isPending}>
          Connect Trello
        </Button>
      </form>

      <form
        className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10"
        onSubmit={handleConnectClickUp}
      >
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <img src={clickupLogo} alt="" className="h-5 w-5" />
          Connect ClickUp
        </h2>
        <p className="text-text-muted text-xs">
          Enter the List ID new tasks should be created in, then authorize with ClickUp.
        </p>
        <input
          required
          placeholder="List ID"
          value={clickupListId}
          onChange={(event) => setClickupListId(event.target.value)}
          className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10 dark:bg-transparent"
        />
        <Button type="submit">Continue to ClickUp</Button>
      </form>
    </main>
  );
}

export { CLICKUP_PENDING_KEY };
