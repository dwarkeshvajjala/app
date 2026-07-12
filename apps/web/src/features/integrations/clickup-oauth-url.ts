const CLICKUP_CLIENT_ID = import.meta.env.VITE_CLICKUP_OAUTH_CLIENT_ID ?? "";

export function buildClickUpAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLICKUP_CLIENT_ID,
    redirect_uri: `${window.location.origin}/integrations/clickup/callback`,
  });
  return `https://app.clickup.com/api?${params.toString()}`;
}
