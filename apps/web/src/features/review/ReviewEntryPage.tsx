import { Button } from "@backline/ui";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { API_BASE_URL, ApiError } from "../../lib/api-client";
import * as reviewApi from "./api";
import { AssetReview } from "../assets/AssetReview";

// Guest reviewer entry (05-Frontend-Architecture.md §5.2) - outside the dashboard shell
// entirely. Resolves the share link, collects a name (+ passcode if required), creates
// the guest session, then hands off to the actual reviewed page: the agency's own site
// in snippet mode, or Backline's own proxy route in proxy mode
// (03-System-Architecture.md §3.3) - either way, the already-created session rides
// along as a query param so the injected/embedded widget doesn't prompt for a name
// again (apps/widget/src/guest-session.ts reads it).
export function ReviewEntryPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [displayName, setDisplayName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState<string | null>(null);
  const [assetGuest, setAssetGuest] = useState<string | null>(null);

  const {
    data: resolved,
    isLoading,
    error: resolveError,
  } = useQuery({
    queryKey: ["review", shareToken],
    queryFn: () => reviewApi.resolveShareLink(shareToken!),
    enabled: !!shareToken && !handoffUrl,
    retry: false,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!shareToken || !resolved) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await reviewApi.createGuestSession(
        shareToken,
        displayName,
        passcode || undefined,
      );
      const handoff = new URLSearchParams({
        backline_guest: result.guest_session_token,
        backline_name: result.display_name,
      });
      if (resolved.project_type && resolved.project_type !== "website") {
        setAssetGuest(result.guest_session_token);
        return;
      }
      const destination =
        resolved.mode === "proxy"
          ? `${API_BASE_URL}/proxy/${shareToken}/?${handoff.toString()}`
          : `${resolved.target_origin}${resolved.target_origin.includes("?") ? "&" : "?"}${handoff.toString()}`;
      setHandoffUrl(destination);
      window.location.href = destination;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!shareToken) {
    return <ErrorScreen message="Missing share link." />;
  }
  if (assetGuest && resolved) {
    return <AssetReview projectId={resolved.project_id} title={resolved.project_name} guest={assetGuest} />;
  }

  if (handoffUrl) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Taking you to the site...</h1>
        <p className="text-text-muted text-sm">
          If nothing happens,{" "}
          <a href={handoffUrl} className="underline">
            click here
          </a>
          .
        </p>
      </main>
    );
  }

  if (isLoading) {
    return <p className="text-text-muted p-6 text-center text-sm">Loading...</p>;
  }

  if (resolveError) {
    const message =
      resolveError instanceof ApiError
        ? resolveError.message
        : "This review link could not be opened.";
    return <ErrorScreen message={message} />;
  }

  if (!resolved) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-xl font-semibold">Review {resolved.project_name}</h1>
        <p className="text-text-muted mt-1 text-sm">Tell us who's reviewing - no account needed.</p>
      </div>

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          Your name
          <input
            required
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>

        {resolved.requires_passcode && (
          <label className="flex flex-col gap-1 text-sm">
            Passcode
            <input
              type="password"
              required
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
            />
          </label>
        )}

        {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
        <Button type="submit" disabled={isSubmitting}>
          Start reviewing
        </Button>
      </form>
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-recovery-orphaned">{message}</p>
    </main>
  );
}
