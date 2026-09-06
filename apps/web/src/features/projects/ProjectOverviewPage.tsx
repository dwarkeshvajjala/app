import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";

import { useWSEvent } from "../../app/WSProvider";
import { API_BASE_URL } from "../../lib/api-client";
import { qk } from "../../lib/query-keys";
import * as boardApi from "../board/api";
import type { CommentOut } from "../board/api";
import * as shareLinksApi from "../share-links/api";
import { ShareProjectModal } from "../workspaces/ShareProjectModal";
import type { WorkspaceOut } from "../workspaces/api";
import * as projectsApi from "./api";
import { ProjectFooter, type CanvasMode } from "./footer/ProjectFooter";
import type { ViewportOption } from "./footer/ViewportMenu";
import { ProjectSidePanel } from "./panel/ProjectSidePanel";
import { AssetReview } from "../assets/AssetReview";

export function ProjectOverviewPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { projectId } = useParams<{ projectId: string }>();
  const [showShare, setShowShare] = useState(false);
  const [mode, setMode] = useState<CanvasMode>("comment");
  const [viewport, setViewport] = useState<ViewportOption | null>(null);
  const canvasRef = useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();
  // Cross-origin (the canvas is served from the API's own proxy origin, not this
  // dashboard's) - the widget (apps/widget/src/index.ts) posts this once it knows
  // which page it registered, so "show comments on current page only" has something to
  // filter against. Reset on iframe navigation isn't possible to detect directly
  // (cross-origin), so this only ever reflects the most recent page the widget itself
  // reported - stale until the next full load reports a new one.
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);

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

  const { data: comments } = useQuery({
    queryKey: qk.projectComments(projectId ?? ""),
    queryFn: () => boardApi.listProjectComments(projectId!),
    enabled: !!projectId,
  });

  // Comments panel/Details tab share this same query - without live updates, a guest
  // commenting through this very canvas (or via the widget elsewhere) wouldn't show up
  // here until the query's 30s staleTime lapsed, reading as "my comment didn't save"
  // even though it did. Same targeted-merge pattern BoardPage already uses, not a
  // blind invalidate (14-State-Management.md §14.4).
  const upsertComment = useCallback(
    (payload: CommentOut & { project_id: string }) => {
      if (payload.project_id !== projectId) return;
      queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId ?? ""), (old) => {
        if (!old) return old;
        const existingIndex = old.findIndex((c) => c.id === payload.id);
        if (existingIndex === -1) return [...old, payload];
        const next = [...old];
        next[existingIndex] = payload;
        return next;
      });
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.created", upsertComment);
  useWSEvent("comment.updated", upsertComment);

  const removeComment = useCallback(
    (payload: { comment_id: string; project_id: string }) => {
      if (payload.project_id !== projectId) return;
      queryClient.setQueryData<CommentOut[]>(qk.projectComments(projectId ?? ""), (old) =>
        old ? old.filter((c) => c.id !== payload.comment_id) : old,
      );
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.deleted", removeComment);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== canvasRef.current?.contentWindow) return;
      if (event.data?.type !== "backline:page-registered") return;
      setCurrentPageId(event.data.pageId as string);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (isLoading) {
    return <p className="text-text-muted p-6 text-sm">Loading...</p>;
  }

  if (!project) {
    return <p className="text-recovery-orphaned p-6 text-sm">Project not found.</p>;
  }

  const activeLinks = (shareLinks ?? []).filter((link) => link.revoked_at === null);
  if (project.archived_at) {
    return <main className="bl-wrap"><h1>This project is archived</h1><Link className="bl-button" to={`/w/${workspace.slug}?archived=true`}>Go to archived projects</Link></main>;
  }
  if (project.project_type && project.project_type !== "website") {
    return <AssetReview projectId={project.id} title={project.name} workspaceSlug={workspace.slug} />;
  }
  // Proxy mode is embeddable regardless of whether the real site has the Review SDK
  // installed (07-Review-SDK.md) - snippet mode only works if the client's own site
  // already has it, so proxy is the reliable default for "show me the live site here."
  const embedLink = activeLinks.find((link) => link.mode === "proxy") ?? activeLinks[0];
  const canvasUrl = embedLink ? `${API_BASE_URL}/proxy/${embedLink.token}/` : null;
  // blMode tells the widget (apps/widget/src/index.ts) whether to attach its
  // click-to-create-comment listener at all - Browse mode leaves the site otherwise
  // untouched (existing pins still visible for context), Comment mode is this widget's
  // full normal behavior. Changing it changes the iframe's own src, which is what
  // actually reloads it with the new mode - there's no live channel into an
  // already-loaded proxied page's widget instance.
  const iframeSrc = canvasUrl ? `${canvasUrl}?blMode=${mode}` : null;
  const totalComments = comments?.length ?? 0;

  // h-screen, not calc(100vh - Npx): this page renders under ProjectLayout, which
  // (unlike the dashboard's WorkspaceLayout) adds no chrome above it - its own header
  // below is already inside this box. Subtracting a header height here left exactly
  // that much dead space under the footer, which read as an oversized footer band.
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-black/10 px-4 py-2 dark:border-white/10">
        <div className="flex min-w-0 items-center gap-3">
          <Link to={`/w/${workspace.slug}`} className="text-text-muted shrink-0 text-xs underline">
            ← Back
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{project.name}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {canvasUrl && (
            <a
              href={canvasUrl}
              target="_blank"
              rel="noreferrer"
              className="text-text-muted text-xs underline"
            >
              Open in new tab ↗
            </a>
          )}
          <Link
            to={`/w/${workspace.slug}/p/${project.id}/board`}
            className="text-text-muted text-xs underline"
          >
            Board
          </Link>
          <Link
            to={`/w/${workspace.slug}/p/${project.id}/share-links`}
            className="text-text-muted text-xs underline"
          >
            Share links
          </Link>
          <button
            onClick={() => setShowShare(true)}
            className="bg-accent-primary rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Share
          </button>
        </div>
      </div>

      {/* relative, not a flex row with the panel as a sibling: the panel is an overlay
          (position: absolute, see ProjectSidePanel) that floats on top of this canvas
          rather than sharing width with it - the iframe always keeps its full,
          unchanged viewport size, so the reviewed site's own responsive layout never
          reflows just because a reviewer opened a side panel. */}
      <div className="bg-bg-canvas relative min-h-0 flex-1">
        {iframeSrc ? (
          <div className="flex h-full items-center justify-center overflow-auto">
            <iframe
              ref={canvasRef}
              src={iframeSrc}
              title={`${project.name} preview`}
              className="border-0"
              style={
                viewport
                  ? { width: viewport.width, height: viewport.height, flexShrink: 0 }
                  : { width: "100%", height: "100%" }
              }
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6">
            <p className="text-text-muted max-w-sm text-center text-sm">
              No active share link yet - create one to preview the live site here.
            </p>
          </div>
        )}
        <ProjectSidePanel
          project={project}
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          canvasRef={canvasRef}
          currentPageId={currentPageId}
        />
      </div>

      <ProjectFooter
        project={project}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        totalComments={totalComments}
        mode={mode}
        onModeChange={setMode}
        viewport={viewport}
        onViewportChange={setViewport}
      />

      {showShare && (
        <ShareProjectModal
          project={project}
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
