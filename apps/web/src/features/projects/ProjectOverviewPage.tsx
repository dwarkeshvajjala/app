import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import * as shareLinksApi from "../share-links/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as projectsApi from "./api";

function reviewUrl(token: string): string {
  return `${window.location.origin}/review/${token}`;
}

export function ProjectOverviewPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { projectId } = useParams<{ projectId: string }>();
  const [copied, setCopied] = useState(false);

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: shareLinks } = useQuery({
    queryKey: ["project", projectId, "share-links"],
    queryFn: () => shareLinksApi.listShareLinks(projectId!),
    enabled: !!projectId,
  });

  if (isLoading) {
    return <p className="text-text-muted p-6 text-sm">Loading...</p>;
  }

  if (!project) {
    return <p className="text-recovery-orphaned p-6 text-sm">Project not found.</p>;
  }

  // The most recently created active link - every project gets one automatically the
  // instant it's created (Milestone 9's onboarding tightening: "install-free path
  // first," no separate trip to Share Links required before something is shareable).
  const activeLink = (shareLinks ?? []).find((link) => link.revoked_at === null);

  async function copyLink() {
    if (!activeLink) return;
    await navigator.clipboard.writeText(reviewUrl(activeLink.token));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link to={`/w/${workspace.slug}`} className="text-text-muted text-xs underline">
        Back to {workspace.name}
      </Link>
      <h1 className="mt-2 text-xl font-semibold">{project.name}</h1>
      <p className="text-text-muted text-sm">{project.target_origin}</p>

      {activeLink && (
        <div className="mt-6 rounded-md border border-black/10 p-4 dark:border-white/10">
          <p className="text-sm font-medium">Share this with your client</p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={reviewUrl(activeLink.token)}
              className="text-text-muted flex-1 truncate rounded-md border border-black/10 bg-transparent px-3 py-2 text-xs dark:border-white/10"
              onFocus={(event) => event.target.select()}
            />
            <button
              onClick={copyLink}
              className="bg-accent-primary rounded-md px-3 py-2 text-xs font-medium text-white hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <Link
          to={`/w/${workspace.slug}/p/${project.id}/board`}
          className="hover:bg-bg-canvas rounded-md border border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10"
        >
          Board
        </Link>
        <Link
          to={`/w/${workspace.slug}/p/${project.id}/share-links`}
          className="hover:bg-bg-canvas rounded-md border border-black/10 px-4 py-3 text-sm font-medium dark:border-white/10"
        >
          Share links
        </Link>
      </div>
    </main>
  );
}
