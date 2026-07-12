import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import * as integrationsApi from "./api";
import { CLICKUP_PENDING_KEY } from "./IntegrationsPage";

// Outside the dashboard shell entirely (same shape as features/auth/AuthCallbackPage) -
// ClickUp's OAuth redirect lands here with just a `code`, so the workspace + list id
// chosen before the redirect (IntegrationsPage) has to survive out-of-band, in
// sessionStorage, the same way there's no other way to carry application state through
// a third party's OAuth round trip.
export function ClickUpOAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const code = searchParams.get("code");
    const pendingRaw = sessionStorage.getItem(CLICKUP_PENDING_KEY);
    if (!code || !pendingRaw) {
      setError("Missing authorization code or pending connection details.");
      return;
    }
    sessionStorage.removeItem(CLICKUP_PENDING_KEY);
    const pending = JSON.parse(pendingRaw) as {
      workspaceId: string;
      workspaceSlug: string;
      listId: string;
    };

    integrationsApi
      .connectClickUp(pending.workspaceId, { oauthCode: code, listId: pending.listId })
      .then(() => navigate(`/w/${pending.workspaceSlug}/integrations`, { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "ClickUp connection failed.");
      });
  }, [searchParams, navigate]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      {error ? (
        <p className="text-recovery-orphaned">{error}</p>
      ) : (
        <p className="text-text-muted">Connecting ClickUp...</p>
      )}
    </main>
  );
}
