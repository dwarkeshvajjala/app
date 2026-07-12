import { Button } from "@backline/ui";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { useParams } from "react-router-dom";

import { ApiError } from "../../lib/api-client";
import { getStoredGuestSession, setStoredGuestSession } from "../../lib/guest-session-storage";
import * as reviewApi from "./api";

// Guest reviewer entry (05-Frontend-Architecture.md §5.2) - outside the dashboard shell
// entirely. The actual pin-drop/comment overlay is the Review SDK, built in Milestone 3;
// this page only proves the share-link resolution + guest-session creation flow end to end.
export function ReviewEntryPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [displayName, setDisplayName] = useState("");
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [session, setSession] = useState(() =>
    shareToken ? getStoredGuestSession(shareToken) : null,
  );

  const {
    data: resolved,
    isLoading,
    error: resolveError,
  } = useQuery({
    queryKey: ["review", shareToken],
    queryFn: () => reviewApi.resolveShareLink(shareToken!),
    enabled: !!shareToken && !session,
    retry: false,
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!shareToken) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await reviewApi.createGuestSession(
        shareToken,
        displayName,
        passcode || undefined,
      );
      const stored = { guestSessionToken: result.guest_session_token, displayName };
      setStoredGuestSession(shareToken, stored);
      setSession(stored);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join this review.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!shareToken) {
    return <ErrorScreen message="Missing share link." />;
  }

  if (session) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">You're in, {session.displayName}</h1>
        <p className="text-text-muted text-sm">
          Commenting on the live page lands in Milestone 3 - this confirms your guest session
          resolved correctly.
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
