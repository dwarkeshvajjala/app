import type { Schemas } from "@backline/types";

import { apiFetch } from "../../lib/api-client";

export type IntegrationOut = Schemas["IntegrationOut"];
export type CreateClickUpTaskResult = Schemas["CreateClickUpTaskResult"];
export type CreateTrelloCardResult = Schemas["CreateTrelloCardResult"];

export function listIntegrations(workspaceId: string): Promise<IntegrationOut[]> {
  return apiFetch<IntegrationOut[]>(`/api/v1/workspaces/${workspaceId}/integrations`);
}

export function connectSlack(
  workspaceId: string,
  options: { webhookUrl: string; notifyStatusChanges: boolean; notifyTeamLayer: boolean },
): Promise<IntegrationOut> {
  return apiFetch<IntegrationOut>(`/api/v1/workspaces/${workspaceId}/integrations`, {
    method: "POST",
    body: JSON.stringify({
      type: "slack",
      webhook_url: options.webhookUrl,
      notify_status_changes: options.notifyStatusChanges,
      notify_team_layer: options.notifyTeamLayer,
    }),
  });
}

export function connectTrello(
  workspaceId: string,
  options: { apiKey: string; token: string; listId: string },
): Promise<IntegrationOut> {
  return apiFetch<IntegrationOut>(`/api/v1/workspaces/${workspaceId}/integrations`, {
    method: "POST",
    body: JSON.stringify({
      type: "trello",
      api_key: options.apiKey,
      token: options.token,
      list_id: options.listId,
    }),
  });
}

export function connectClickUp(
  workspaceId: string,
  options: { oauthCode: string; listId: string },
): Promise<IntegrationOut> {
  return apiFetch<IntegrationOut>(`/api/v1/workspaces/${workspaceId}/integrations`, {
    method: "POST",
    body: JSON.stringify({
      type: "clickup",
      oauth_code: options.oauthCode,
      list_id: options.listId,
    }),
  });
}

export function disconnectIntegration(integrationId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/integrations/${integrationId}`, { method: "DELETE" });
}

export function createClickUpTask(
  commentId: string,
  integrationId: string,
): Promise<CreateClickUpTaskResult> {
  return apiFetch<CreateClickUpTaskResult>(
    `/api/v1/comments/${commentId}/integrations/clickup/create-task?integration_id=${integrationId}`,
    { method: "POST" },
  );
}

export function createTrelloCard(
  commentId: string,
  integrationId: string,
): Promise<CreateTrelloCardResult> {
  return apiFetch<CreateTrelloCardResult>(
    `/api/v1/comments/${commentId}/integrations/trello/create-card?integration_id=${integrationId}`,
    { method: "POST" },
  );
}
