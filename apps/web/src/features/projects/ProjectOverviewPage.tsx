import type { Schemas } from "@backline/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type CSSProperties, type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext, useParams, useSearchParams } from "react-router-dom";

import { useWSEvent } from "../../app/WSProvider";
import { API_BASE_URL, apiFetch } from "../../lib/api-client";
import { removeProjectComment, upsertProjectComment } from "../../lib/comment-cache";
import { qk } from "../../lib/query-keys";
import { AssetReview } from "../assets/AssetReview";
import * as boardApi from "../board/api";
import type { CommentOut } from "../board/api";
import * as shareLinksApi from "../share-links/api";
import { ShareProjectModal } from "../workspaces/ShareProjectModal";
import type { WorkspaceOut } from "../workspaces/api";
import * as projectsApi from "./api";
import { ProjectFooter, type CanvasMode } from "./footer/ProjectFooter";
import { VIEWPORTS, type ViewportOption } from "./footer/ViewportMenu";
import { BROWSERS, type BrowserOption } from "./footer/BrowserMenu";
import {
  ArrowLeftIcon,
  CommentsIcon,
  ExternalLinkIcon,
  GlobeIcon,
  PointerIcon,
  ReloadIcon,
  ShareIcon,
} from "./panel/icons";
import { ProjectSidePanel } from "./panel/ProjectSidePanel";
import { ProjectForm } from "./ProjectForm";
import { ProjectMenu } from "./ProjectMenu";
import { ProjectPagesModal } from "./ProjectPagesModal";
import { ThemeToggle } from "../../components/ThemeToggle";

type PageOut = Schemas["PageOut"];

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.5;

function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));
}

function reviewUrl(token: string) {
  return `${window.location.origin}/review/${token}`;
}

function pageLabel(page: PageOut) {
  if (page.title) return page.title;
  try {
    return new URL(page.url_normalized).pathname || "/";
  } catch {
    return page.url_normalized;
  }
}

export function ProjectOverviewPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showShare, setShowShare] = useState(false);
  const [showPages, setShowPages] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [iframeStatus, setIframeStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [retryCount, setRetryCount] = useState(0);
  const canvasRef = useRef<HTMLIFrameElement>(null);
  const pageTabsRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const activePageIdParam = searchParams.get("page");
  const mode: CanvasMode = searchParams.get("mode") === "browse" ? "browse" : "comment";
  const orientation = searchParams.get("orientation") === "landscape" ? "landscape" : "portrait";
  const zoomScale = clampZoom(Number(searchParams.get("zoom") ?? 1));
  const viewport = useMemo<ViewportOption | null>(() => {
    const name = searchParams.get("viewport");
    if (!name) return null;
    if (name === "Custom") {
      const width = Number(searchParams.get("viewportWidth"));
      const height = Number(searchParams.get("viewportHeight"));
      if (width >= 280 && width <= 2560 && height >= 320 && height <= 2000) {
        return { name, width, height };
      }
      return null;
    }
    return VIEWPORTS.find((option) => option.name === name) ?? null;
  }, [searchParams]);
  const browser = useMemo<BrowserOption>(() => {
    const name = searchParams.get("browser");
    if (!name) return BROWSERS[0];
    return BROWSERS.find((option) => option.name === name) ?? BROWSERS[0];
  }, [searchParams]);

  const pagesQuery = useQuery({
    queryKey: qk.projectPages(projectId ?? ""),
    queryFn: () => apiFetch<PageOut[]>(`/api/v1/projects/${projectId}/pages`),
    enabled: !!projectId,
  });
  const projectQuery = useQuery({
    queryKey: qk.project(projectId ?? ""),
    queryFn: () => projectsApi.getProject(projectId!),
    enabled: !!projectId,
  });
  const shareLinksQuery = useQuery({
    queryKey: qk.shareLinks(projectId ?? ""),
    queryFn: () => shareLinksApi.listShareLinks(projectId!),
    enabled: !!projectId,
  });
  const commentsQuery = useQuery({
    queryKey: qk.projectComments(projectId ?? ""),
    queryFn: () => boardApi.listProjectComments(projectId!),
    enabled: !!projectId,
  });
  const hasProxyCandidate = (shareLinksQuery.data ?? []).some(
    (link) => link.revoked_at === null && link.mode === "proxy",
  );

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
      if (event.data?.type !== "backline:page-registered") return;
      const pageId = event.data.pageId as string;
      setCurrentPageId(pageId);
      setIframeStatus("loaded");
      setSearchParams(
        (previous) => {
          if (previous.get("page") === pageId) return previous;
          const next = new URLSearchParams(previous);
          next.set("page", pageId);
          return next;
        },
        { replace: true },
      );
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [setSearchParams]);

  useEffect(() => {
    if (!hasProxyCandidate) return;
    setIframeStatus("loading");
    const timer = window.setTimeout(() => {
      setIframeStatus((current) => current === "loading" ? "error" : current);
    }, 30000);
    return () => window.clearTimeout(timer);
  }, [activePageIdParam, hasProxyCandidate, mode, projectId, retryCount]);

  function updateViewParams(values: Record<string, string | null>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(values)) {
          if (value === null) next.delete(key);
          else next.set(key, value);
        }
        return next;
      },
      { replace: true },
    );
  }

  function goToPage(pageId: string) {
    setCurrentPageId(null);
    setSelectedCommentId(null);
    updateViewParams({ page: pageId || null });
  }

  function setMode(nextMode: CanvasMode) {
    updateViewParams({ mode: nextMode === "comment" ? null : nextMode });
  }

  function setViewport(nextViewport: ViewportOption | null) {
    updateViewParams({
      viewport: nextViewport?.name ?? null,
      viewportWidth: nextViewport?.name === "Custom" ? String(nextViewport.width) : null,
      viewportHeight: nextViewport?.name === "Custom" ? String(nextViewport.height) : null,
      orientation: nextViewport ? searchParams.get("orientation") : null,
    });
  }

  function setZoom(nextZoom: number) {
    const normalized = clampZoom(nextZoom);
    updateViewParams({ zoom: normalized === 1 ? null : normalized.toFixed(1) });
  }

  function reloadPreview() {
    setIframeStatus("loading");
    setRetryCount((count) => count + 1);
  }

  function onPageTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number, pageIds: string[]) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % pageIds.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + pageIds.length) % pageIds.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = pageIds.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    goToPage(pageIds[nextIndex]);
    requestAnimationFrame(() => {
      const tabs = pageTabsRef.current?.querySelectorAll<HTMLButtonElement>("[data-page-tab]");
      tabs?.[nextIndex!]?.focus();
    });
  }

  if (projectQuery.isLoading) {
    return (
      <main className="bl-review-gate" aria-busy="true">
        <span className="bl-loading-mark" aria-hidden="true">B</span>
        <div className="bl-review-gate-copy">
          <span className="bl-review-eyebrow">Review workspace</span>
          <h1>Opening project</h1>
          <div className="bl-review-gate-line" aria-hidden="true"><i /></div>
        </div>
      </main>
    );
  }

  if (projectQuery.error || !projectQuery.data) {
    return (
      <main className="bl-review-gate">
        <span className="bl-loading-mark" aria-hidden="true">B</span>
        <div className="bl-review-gate-copy">
          <span className="bl-review-eyebrow">Review workspace</span>
          <h1>{projectQuery.error ? "Couldn’t load this project" : "Project not found"}</h1>
          <p>{projectQuery.error?.message ?? "The project may have moved or you may no longer have access."}</p>
          <div className="bl-review-gate-actions">
            {projectQuery.error && <button type="button" className="bl-button" onClick={() => void projectQuery.refetch()}>Try again</button>}
            <Link className="bl-quiet" to={`/w/${workspace.slug}`}>All projects</Link>
          </div>
        </div>
      </main>
    );
  }

  const project = projectQuery.data;
  if (project.archived_at) {
    return (
      <main className="bl-review-gate">
        <span className="bl-loading-mark" aria-hidden="true">B</span>
        <div className="bl-review-gate-copy">
          <span className="bl-review-eyebrow">Archived project</span>
          <h1>{project.name}</h1>
          <p>Restore this project before opening its review workspace. Its comments and history are still retained.</p>
          <Link className="bl-button" to={`/w/${workspace.slug}?archived=true`}>View archived projects</Link>
        </div>
      </main>
    );
  }

  if (project.project_type && project.project_type !== "website") {
    return <AssetReview projectId={project.id} title={project.name} workspaceSlug={workspace.slug} />;
  }

  const sortedPages = [...(pagesQuery.data ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const activePage =
    sortedPages.find((page) => page.id === activePageIdParam) ??
    sortedPages.find((page) => page.id === currentPageId) ??
    sortedPages[0] ??
    null;
  const activeLinks = (shareLinksQuery.data ?? []).filter((link) => link.revoked_at === null);
  const reviewLink = activeLinks[0] ?? null;
  const embedLink = activeLinks.find((link) => link.mode === "proxy") ?? null;
  const canvasUrl = embedLink ? `${API_BASE_URL}/proxy/${embedLink.token}/` : null;

  function proxyRequestFor(page: PageOut | null): { path: string; search: URLSearchParams } | null {
    if (!page) return { path: "", search: new URLSearchParams() };
    try {
      const pageUrl = new URL(page.url_normalized);
      const targetUrl = new URL(project.target_origin);
      if (pageUrl.host !== targetUrl.host) return null;
      return { path: pageUrl.pathname.replace(/^\//, ""), search: new URLSearchParams(pageUrl.search) };
    } catch {
      return null;
    }
  }

  const activePageRequest = proxyRequestFor(activePage);
  const iframeSearch = new URLSearchParams(activePageRequest?.search);
  iframeSearch.set("blMode", mode);
  const iframeSrc = canvasUrl && activePageRequest
    ? `${API_BASE_URL}/proxy/${embedLink!.token}/${activePageRequest.path}?${iframeSearch.toString()}`
    : null;
  const displayUrl = activePage?.url_normalized || project.target_origin;
  const topLevelComments = (commentsQuery.data ?? []).filter((comment) => !comment.parent_id);
  const selectedCommentNumber = selectedCommentId
    ? topLevelComments
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .findIndex((comment) => comment.id === selectedCommentId) + 1
    : 0;
  const visibleWidth = viewport
    ? orientation === "portrait"
      ? viewport.width
      : viewport.height
    : undefined;
  const visibleHeight = viewport
    ? orientation === "portrait"
      ? viewport.height
      : viewport.width
    : undefined;
  const pageIds = sortedPages.map((page) => page.id);
  const effectiveFrameStatus = iframeSrc ? iframeStatus : "unavailable";

  return (
    <main className="bl-review-workspace">
      <header className="bl-review-header">
        <div className="bl-review-identity">
          <Link to={`/w/${workspace.slug}`} className="bl-review-icon-button" aria-label="Back to all projects" title="All projects">
            <ArrowLeftIcon />
          </Link>
          <div>
            <div className="bl-review-title-line">
              <h1>{project.name}</h1>
              <span className={`bl-review-environment is-${project.environment}`}>
                <i aria-hidden="true" />
                {project.environment}
              </span>
            </div>
            <a href={displayUrl} target="_blank" rel="noreferrer" className="bl-review-url" title="Open the live page in a new tab">
              <span>{displayUrl.replace(/^https?:\/\//, "")}</span>
              <ExternalLinkIcon width={10} height={10} />
            </a>
          </div>
        </div>

        <div className="bl-review-header-tools">
          <div className="bl-review-mode" aria-label="Canvas mode">
            <button type="button" aria-pressed={mode === "browse"} onClick={() => setMode("browse")}>
              <PointerIcon width={13} height={13} />
              Browse
            </button>
            <button type="button" aria-pressed={mode === "comment"} onClick={() => setMode("comment")}>
              <CommentsIcon width={13} height={13} />
              Comment
            </button>
          </div>
          <button type="button" className="bl-review-icon-button" aria-label="Reload preview" title="Reload preview" onClick={reloadPreview} disabled={!iframeSrc}>
            <ReloadIcon className={iframeStatus === "loading" && iframeSrc ? "bl-is-spinning" : ""} />
          </button>
          <a className="bl-review-icon-button" href={displayUrl} target="_blank" rel="noreferrer" aria-label="Open live page" title="Open live page">
            <ExternalLinkIcon />
          </a>
          {reviewLink ? (
            <a className="bl-review-control bl-review-open" href={reviewUrl(reviewLink.token)} target="_blank" rel="noreferrer">
              Open review
              <ExternalLinkIcon width={12} height={12} />
            </a>
          ) : (
            <button type="button" className="bl-review-control" disabled title="Create a review link from Share first">Open review</button>
          )}
          <button type="button" className="bl-review-control" onClick={() => setShowShare(true)}>
            <ShareIcon width={13} height={13} />
            Share
          </button>
          <ThemeToggle />
          <ProjectMenu
            project={project}
            workspaceSlug={workspace.slug}
            onManagePages={() => setShowPages(true)}
            onShare={() => setShowShare(true)}
            onSettings={() => setShowSettings(true)}
          />
        </div>
      </header>

      <div className="bl-review-pagebar">
        <div className="bl-review-page-tabs" ref={pageTabsRef} role={sortedPages.length > 0 ? "tablist" : undefined} aria-label={sortedPages.length > 0 ? "Project pages" : undefined}>
          {pagesQuery.isLoading && (
            <div className="bl-review-tabs-loading" role="status" aria-label="Loading project pages">
              <i /><i /><i />
            </div>
          )}
          {pagesQuery.error && (
            <div className="bl-review-page-error" role="alert">
              <span>Pages unavailable.</span>
              <button type="button" onClick={() => void pagesQuery.refetch()}>Retry</button>
            </div>
          )}
          {!pagesQuery.isLoading && !pagesQuery.error && sortedPages.length === 0 && (
            <span className="bl-review-page-empty">No saved pages yet. The first proxied visit can register one.</span>
          )}
          {sortedPages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              role="tab"
              data-page-tab
              tabIndex={activePage?.id === page.id ? 0 : -1}
              aria-selected={activePage?.id === page.id}
              onClick={() => goToPage(page.id)}
              onKeyDown={(event) => onPageTabKeyDown(event, index, pageIds)}
            >
              <span>{pageLabel(page)}</span>
              {activePage?.id === page.id && <i aria-hidden="true" />}
            </button>
          ))}
        </div>
        <button type="button" className="bl-review-manage-pages" onClick={() => setShowPages(true)}>
          Manage pages
        </button>
      </div>

      <section className="bl-review-main" aria-label="Website review canvas">
        <div className={`bl-review-stage ${mode === "comment" ? "is-commenting" : "is-browsing"}`}>
          {shareLinksQuery.isLoading ? (
            <div className="bl-review-empty-canvas" role="status">
              <span className="bl-review-loader" aria-hidden="true" />
              <strong>Preparing the review source</strong>
              <p>Checking for an active proxy review link…</p>
            </div>
          ) : shareLinksQuery.error ? (
            <div className="bl-review-empty-canvas" role="alert">
              <span className="bl-review-state-icon is-warning"><GlobeIcon /></span>
              <strong>Couldn’t check the review link</strong>
              <p>{shareLinksQuery.error.message}</p>
              <button type="button" className="bl-button" onClick={() => void shareLinksQuery.refetch()}>Try again</button>
            </div>
          ) : embedLink && !activePageRequest ? (
            <div className="bl-review-empty-canvas" role="alert">
              <span className="bl-review-state-icon is-warning"><GlobeIcon /></span>
              <strong>This saved page is outside the project URL</strong>
              <p>Backline will not proxy a page from a different host. Update the page or project URL before reviewing it here.</p>
              <div className="bl-review-empty-actions">
                <button type="button" className="bl-button" onClick={() => setShowPages(true)}>Manage pages</button>
                <button type="button" className="bl-quiet" onClick={() => setShowSettings(true)}>Check project URL</button>
              </div>
            </div>
          ) : iframeSrc ? (
            <div
              className={`bl-live-frame-shell ${viewport ? "is-fixed" : "is-fit"}`}
              style={{ width: visibleWidth, height: visibleHeight, zoom: zoomScale } as CSSProperties}
            >
              <div className="bl-live-frame-bar">
                <span className="bl-live-frame-lights" aria-hidden="true"><i /><i /><i /></span>
                <span className="bl-live-frame-address" title={displayUrl}>{displayUrl.replace(/^https?:\/\//, "")}</span>
                <span className="bl-live-frame-source"><i aria-hidden="true" />Safe proxy</span>
                <button type="button" onClick={reloadPreview} aria-label="Reload proxy preview" title="Reload proxy preview">
                  <ReloadIcon width={13} height={13} className={iframeStatus === "loading" ? "bl-is-spinning" : ""} />
                </button>
              </div>
              <div className="bl-live-frame-canvas">
                <iframe
                  key={`${retryCount}-${iframeSrc}`}
                  ref={canvasRef}
                  src={iframeSrc}
                  title={`${project.name} preview`}
                  onLoad={() => setIframeStatus("loaded")}
                  onError={() => setIframeStatus("error")}
                />
                {iframeStatus === "loading" && (
                  <div className="bl-iframe-state is-loading" role="status">
                    <span className="bl-review-loader" aria-hidden="true" />
                    <strong>Loading {displayUrl.replace(/^https?:\/\//, "")}</strong>
                    <span className="bl-iframe-steps" aria-hidden="true"><i /><i /><i /></span>
                    <p>Backline is loading the page through the private review proxy so its real widget pins can attach safely.</p>
                  </div>
                )}
                {iframeStatus === "error" && (
                  <div className="bl-iframe-state is-error" role="alert">
                    <span className="bl-review-state-icon is-warning"><GlobeIcon /></span>
                    <strong>Couldn’t load this page</strong>
                    <p>The address may be unavailable, behind a login, or blocking the review proxy.</p>
                    <div>
                      <button type="button" className="bl-button" onClick={reloadPreview}>Try again</button>
                      <a className="bl-quiet" href={displayUrl} target="_blank" rel="noreferrer">Open live page</a>
                      <button type="button" className="bl-quiet" onClick={() => setShowSettings(true)}>Check URL</button>
                    </div>
                  </div>
                )}
              </div>
              <div className="bl-live-frame-meta">
                <span>{selectedCommentNumber > 0 ? `Comment ${selectedCommentNumber} selected · locating its pin` : mode === "comment" ? "Comment mode · click the page to place a pin" : "Browse mode · page interactions enabled"}</span>
                <span>Source: proxy</span>
              </div>
            </div>
          ) : (
            <div className="bl-review-empty-canvas">
              <span className="bl-review-state-icon"><ShareIcon /></span>
              <strong>{reviewLink ? "A proxy review link is required" : "No active review link yet"}</strong>
              <p>{reviewLink ? "The active link uses snippet mode and cannot power this embedded canvas. Create a proxy link to review here." : "Create a proxy review link to load the live site and its genuine comment pins in this workspace."}</p>
              <button type="button" className="bl-button mint" onClick={() => setShowShare(true)}>Open Share</button>
              <span>Nothing is simulated until a real link exists.</span>
            </div>
          )}
        </div>

        <ProjectSidePanel
          project={project}
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.name}
          canvasRef={canvasRef}
          currentPageId={currentPageId}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
        />
      </section>

      <ProjectFooter
        project={project}
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspaceName={workspace.name}
        totalComments={topLevelComments.length}
        commentsUnavailable={Boolean(commentsQuery.error)}
        currentPageId={activePage?.id ?? null}
        onSelectPage={goToPage}
        viewport={viewport}
        onViewportChange={setViewport}
        browser={browser}
        onBrowserChange={(nextBrowser) => updateViewParams({ browser: nextBrowser.name === BROWSERS[0].name ? null : nextBrowser.name })}
        orientation={orientation}
        onOrientationChange={(nextOrientation) => updateViewParams({ orientation: nextOrientation === "portrait" ? null : nextOrientation })}
        zoomScale={zoomScale}
        onZoomChange={setZoom}
        iframeStatus={effectiveFrameStatus}
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
    </main>
  );
}
