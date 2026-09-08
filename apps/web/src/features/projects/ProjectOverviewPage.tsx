import type { Schemas } from "@backline/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";

import { useWSEvent } from "../../app/WSProvider";
import { LoadingScreen } from "../../components/LoadingScreen";
import { API_BASE_URL, apiFetch } from "../../lib/api-client";
import { removeProjectComment, upsertProjectComment } from "../../lib/comment-cache";
import { qk } from "../../lib/query-keys";

type PageOut = Schemas["PageOut"];
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
import { ProjectMenu } from "./ProjectMenu";
import { ProjectPagesModal } from "./ProjectPagesModal";
import { ProjectForm } from "./ProjectForm";

export function ProjectOverviewPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showShare, setShowShare] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<CanvasMode>("comment");
  const [viewport, setViewport] = useState<ViewportOption | null>(null);
  const canvasRef = useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();

  // FD-AUD-025: page tabs above the canvas, deep-linkable via ?page=<id> - shares
  // ProjectPagesModal's query key/cache so add/rename/reorder there is reflected here
  // without a second fetch.
  const activePageIdParam = searchParams.get("page");
  const { data: pages } = useQuery({
    queryKey: qk.projectPages(projectId ?? ""),
    queryFn: () => apiFetch<PageOut[]>(`/api/v1/projects/${projectId}/pages`),
    enabled: !!projectId,
  });

  // Cross-origin (the canvas is served from the API's own proxy origin, not this
  // dashboard's) - the widget (apps/widget/src/index.ts) posts this once it knows
  // which page it registered, so "show comments on current page only" has something to
  // filter against. Reset on iframe navigation isn't possible to detect directly
  // (cross-origin), so this only ever reflects the most recent page the widget itself
  // reported - stale until the next full load reports a new one.
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);

  const [iframeStatus, setIframeStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [zoomScale, setZoomScale] = useState(1);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");

  const { data: project, isLoading } = useQuery({
    queryKey: qk.project(projectId ?? ""),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
  });

  const { data: shareLinks } = useQuery({
    queryKey: qk.shareLinks(projectId ?? ""),
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
      upsertProjectComment(queryClient, projectId ?? "", payload);
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.created", upsertComment);
  useWSEvent("comment.updated", upsertComment);

  const removeComment = useCallback(
    (payload: { comment_id: string; project_id: string }) => {
      if (payload.project_id !== projectId) return;
      removeProjectComment(queryClient, projectId ?? "", payload.comment_id);
    },
    [projectId, queryClient],
  );
  useWSEvent("comment.deleted", removeComment);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== canvasRef.current?.contentWindow) return;
      if (event.data?.type === "backline:page-registered") {
        const pageId = event.data.pageId as string;
        setCurrentPageId(pageId);
        setIframeStatus("loaded");
        // Keep the URL's ?page= honest when the reviewer navigates within the
        // reviewed site itself (an internal link), not just when they click a tab.
        setSearchParams(
          (prev) => {
            if (prev.get("page") === pageId) return prev;
            const next = new URLSearchParams(prev);
            next.set("page", pageId);
            return next;
          },
          { replace: true },
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setSearchParams]);

  useEffect(() => {
    setIframeStatus("loading");
    const timer = setTimeout(() => {
      setIframeStatus((current) => current === "loading" ? "error" : current);
    }, 30000);
    return () => clearTimeout(timer);
  }, [projectId, retryCount]);

  if (isLoading) {
    return <LoadingScreen label="Loading project" />;
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

  const sortedPages = [...(pages ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  // currentPageId (what the widget last actually reported) wins over the URL's own
  // ?page= for which tab reads as "active" - the URL param is what *requests* a
  // navigation, currentPageId is what's *actually* loaded right now.
  const activePage =
    sortedPages.find((p) => p.id === currentPageId) ??
    sortedPages.find((p) => p.id === activePageIdParam) ??
    null;

  // Path (+query) within the reviewed site to request through the proxy - "" path
  // means the site's own root, matching canvasUrl's existing bare-trailing-slash
  // default. Falls back to root rather than guessing if a page's stored URL doesn't
  // actually belong to this project's own target_origin.
  function proxyRequestFor(page: PageOut | null): { path: string; search: URLSearchParams } {
    if (!page) return { path: "", search: new URLSearchParams() };
    try {
      const pageUrl = new URL(page.url_normalized);
      const targetUrl = new URL(project!.target_origin);
      if (pageUrl.host !== targetUrl.host) return { path: "", search: new URLSearchParams() };
      return { path: pageUrl.pathname.replace(/^\//, ""), search: new URLSearchParams(pageUrl.search) };
    } catch {
      return { path: "", search: new URLSearchParams() };
    }
  }

  function goToPage(pageId: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (pageId) next.set("page", pageId);
        else next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  // blMode tells the widget (apps/widget/src/index.ts) whether to attach its
  // click-to-create-comment listener at all - Browse mode leaves the site otherwise
  // untouched (existing pins still visible for context), Comment mode is this widget's
  // full normal behavior. Changing it (or the active page's path) changes the iframe's
  // own src, which is what actually reloads it - there's no live channel into an
  // already-loaded proxied page's widget instance.
  const activePageRequest = proxyRequestFor(activePage);
  const iframeSearch = new URLSearchParams(activePageRequest.search);
  iframeSearch.set("blMode", mode);
  const iframeSrc = canvasUrl
    ? `${API_BASE_URL}/proxy/${embedLink!.token}/${activePageRequest.path}?${iframeSearch.toString()}`
    : null;
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
            onClick={() => setShowPages(true)}
            className="text-text-muted text-xs underline"
          >
            Pages
          </button>
          <button
            onClick={() => setShowShare(true)}
            className="bg-accent-primary rounded-md px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
          >
            Share
          </button>
          <ProjectMenu
            project={project}
            workspaceSlug={workspace.slug}
            onManagePages={() => setShowPages(true)}
            onShare={() => setShowShare(true)}
            onSettings={() => setShowSettings(true)}
          />
        </div>
      </div>

      {/* relative, not a flex row with the panel as a sibling: the panel is an overlay
          (position: absolute, see ProjectSidePanel) that floats on top of this canvas
          rather than sharing width with it - the iframe always keeps its full,
          unchanged viewport size, so the reviewed site's own responsive layout never
          reflows just because a reviewer opened a side panel. */}
      <div className="bg-bg-canvas relative min-h-0 flex-1 flex flex-col">
        {iframeSrc ? (
          <>
            {sortedPages.length > 0 && (
              <div
                role="tablist"
                aria-label="Pages"
                className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-black/10 bg-white px-2 py-1 dark:border-white/10 dark:bg-[#1C1C21] z-20"
              >
                {sortedPages.map((page) => (
                  <button
                    key={page.id}
                    role="tab"
                    aria-selected={activePage?.id === page.id}
                    onClick={() => goToPage(page.id)}
                    className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                      activePage?.id === page.id
                        ? "bg-accent-primary text-white"
                        : "text-text-muted hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                  >
                    {page.title || page.url_normalized}
                  </button>
                ))}
              </div>
            )}
            <div className="flex h-10 shrink-0 items-center gap-2 border-b border-black/10 px-4 bg-white dark:bg-[#1C1C21] dark:border-white/10 z-20 shadow-sm">
              <span className="text-xs text-text-muted font-medium truncate flex-1 flex items-center gap-2">
                <span className="bg-black/5 dark:bg-white/5 px-2 py-1 rounded text-black dark:text-white flex-1 truncate font-mono">
                  {canvasUrl}
                </span>
              </span>
              <button onClick={() => setRetryCount(c => c + 1)} className="text-xs font-medium border border-black/10 dark:border-white/10 px-2 py-1 rounded hover:bg-black/5 dark:hover:bg-white/5">
                Reload Frame
              </button>
            </div>
            <div className="flex flex-1 relative items-center justify-center overflow-auto bg-gray-50 dark:bg-gray-900">
              {iframeStatus === "loading" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-black/80">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-primary border-t-transparent"></div>
                <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">Loading preview...</p>
              </div>
            )}
            {iframeStatus === "error" && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white dark:bg-gray-900 px-6 text-center">
                <p className="mb-2 text-sm font-semibold text-red-600">Failed to load preview</p>
                <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                  The website might be blocking iframe embedding or took too long to respond.
                </p>
                <div className="flex gap-4">
                  <button onClick={() => setRetryCount(c => c + 1)} className="bl-button">Retry</button>
                  <a href={canvasUrl!} target="_blank" rel="noreferrer" className="bl-button">Open direct link</a>
                </div>
              </div>
            )}
            <div 
              style={{
                width: viewport ? (orientation === "portrait" ? viewport.width : viewport.height) : "100%",
                height: viewport ? (orientation === "portrait" ? viewport.height : viewport.width) : "100%",
                flexShrink: 0,
                transition: "width 0.3s, height 0.3s",
                transform: `scale(${zoomScale})`,
                transformOrigin: "center center",
              }}
            >
              <iframe
                key={retryCount}
                ref={canvasRef}
                src={iframeSrc}
                title={`${project.name} preview`}
                className="h-full w-full border-0 bg-white shadow-sm ring-1 ring-black/5"
                onLoad={() => setIframeStatus("loaded")}
              />
            </div>
            </div>
          </>
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
        currentPageId={activePage?.id ?? null}
        onSelectPage={goToPage}
        mode={mode}
        onModeChange={setMode}
        viewport={viewport}
        onViewportChange={setViewport}
        orientation={orientation}
        onOrientationChange={setOrientation}
        zoomScale={zoomScale}
        onZoomChange={setZoomScale}
        iframeStatus={iframeStatus}
        onReload={() => setRetryCount(c => c + 1)}
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
      {showPages && (
        <ProjectPagesModal
          project={project}
          activePageId={activePage?.id ?? null}
          onOpenPage={goToPage}
          onClose={() => setShowPages(false)}
        />
      )}
      {showSettings && <ProjectForm workspace={workspace} project={project} onClose={() => setShowSettings(false)} />}
    </div>
  );
}
