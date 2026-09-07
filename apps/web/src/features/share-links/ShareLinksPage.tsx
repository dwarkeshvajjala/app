import { Button } from "@backline/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";

import * as shareLinksApi from "./api";

export function ShareLinksPage() {
  const { projectId, workspaceSlug } = useParams<{
    projectId: string;
    workspaceSlug: string;
  }>();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"snippet" | "proxy">("snippet");
  const [passcode, setPasscode] = useState("");
  const [askReviewerName, setAskReviewerName] = useState(true);
  const [domainRestrictionsStr, setDomainRestrictionsStr] = useState("");
  const [commentExportPermission, setCommentExportPermission] = useState(false);
  const [expiration, setExpiration] = useState<"never" | "7" | "30">("never");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const queryKey = ["project", projectId, "share-links"];
  const { data: links, isLoading } = useQuery({
    queryKey,
    queryFn: () => shareLinksApi.listShareLinks(projectId!),
    enabled: !!projectId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      shareLinksApi.createShareLink(projectId!, {
        mode,
        passcode: passcode || undefined,
        askReviewerName,
        domainRestrictions: domainRestrictionsStr.split(',').map(s => s.trim()).filter(Boolean),
        commentExportPermission,
        expiresAt: expiration === "never" ? undefined : new Date(Date.now() + Number(expiration) * 24 * 60 * 60 * 1000).toISOString(),
      }),
    onSuccess: () => {
      setPasscode("");
      setDomainRestrictionsStr("");
      return queryClient.invalidateQueries({ queryKey });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not create share link.");
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (shareLinkId: string) => shareLinksApi.revokeShareLink(shareLinkId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    createMutation.mutate();
  }

  function reviewUrl(token: string): string {
    return `${window.location.origin}/review/${token}`;
  }

  async function copyLink(id: string, token: string) {
    await navigator.clipboard.writeText(reviewUrl(token));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link
        to={`/w/${workspaceSlug}/p/${projectId}`}
        className="text-text-muted text-xs underline"
      >
        Back to project
      </Link>
      <h1 className="mt-2 text-xl font-semibold">Share links</h1>

      {isLoading && <p className="text-text-muted mt-4 text-sm">Loading...</p>}

      {links && (
        <ul className="mt-4 flex flex-col gap-2">
          {links.map((link) => {
            const isRevoked = link.revoked_at !== null;
            return (
              <li
                key={link.id}
                className="flex items-center justify-between rounded-md border border-black/10 px-4 py-3 dark:border-white/10"
              >
                <div>
                  <p className="font-mono text-sm">{link.token}</p>
                  <p className="text-text-muted text-xs">
                    {link.mode} {link.has_passcode && "· passcode"} {isRevoked && "· revoked"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {!isRevoked && (
                    <>
                      <button
                        className="text-xs underline"
                        onClick={() => copyLink(link.id, link.token)}
                      >
                        {copiedId === link.id ? "Copied!" : "Copy link"}
                      </button>
                      <button
                        className="text-recovery-orphaned text-xs underline"
                        onClick={() => revokeMutation.mutate(link.id)}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form
        className="mt-8 flex flex-col gap-3 border-t border-black/10 pt-6 dark:border-white/10"
        onSubmit={handleCreate}
      >
        <h2 className="text-sm font-medium">New share link</h2>
        <label className="flex flex-col gap-1 text-sm">
          Mode
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as "snippet" | "proxy")}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          >
            <option value="snippet">Snippet (installed on the site)</option>
            <option value="proxy">Proxy (install-free)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Passcode (optional)
          <input
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
        
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={askReviewerName} onChange={(e) => setAskReviewerName(e.target.checked)} />
          Ask reviewer for their name
        </label>
        
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={commentExportPermission} onChange={(e) => setCommentExportPermission(e.target.checked)} />
          Allow guests to export comments
        </label>

        <label className="flex flex-col gap-1 text-sm mt-2">
          Domain restrictions (comma-separated, optional)
          <input
            value={domainRestrictionsStr}
            onChange={(event) => setDomainRestrictionsStr(event.target.value)}
            placeholder="example.com, myagency.com"
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
        
        <label className="flex flex-col gap-1 text-sm mt-2">
          Expiration policy
          <select
            value={expiration}
            onChange={(event) => setExpiration(event.target.value as "never" | "7" | "30")}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          >
            <option value="never">Never expires</option>
            <option value="7">7 days</option>
            <option value="30">30 days</option>
          </select>
        </label>

        {error && <p className="text-recovery-orphaned text-sm">{error}</p>}
        <Button type="submit" disabled={createMutation.isPending}>
          Create share link
        </Button>
      </form>
    </main>
  );
}
