import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@backline/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useWSEvent } from "../WSProvider";

import { qk } from "../../lib/query-keys";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useWorkspaceContext } from "./useWorkspaceContext";
import { DashboardSidebar } from "./DashboardSidebar";
import { AccountModal } from "../../features/auth/AccountModal";
import { useAuth } from "../../features/auth/AuthContext";
import { GlobalSearch } from "../../features/dashboard/GlobalSearch";
import { NotificationBell } from "../../features/notifications/NotificationBell";
import { useConnectionStore } from "../../stores/connectionStore";
import { BrandMark } from "../../components/BrandMark";
import { PlusIcon } from "../../components/icons";
import { CloseIcon, MenuIcon } from "./sidebar-icons";
import { ProjectForm } from "../../features/projects/ProjectForm";

// Account entry point - top-right of the persistent topbar, next to search and
// notifications, rather than a text button buried at the bottom of the sidebar
// (where the eye has to travel past the whole nav to find it every time).
function AccountButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="bl-account-btn" aria-label="Your account" onClick={() => setOpen(true)}>
        <Avatar name={user?.name ?? "?"} avatarUrl={user?.avatar_url} size={32} />
      </button>
      {open && <AccountModal onClose={() => setOpen(false)} />}
    </>
  );
}

// The dashboard chrome (sidebar + everything under it: project grid, members, billing,
// settings, usage, mcp) - deliberately NOT used for an open project's own routes
// (ProjectLayout), which need the full viewport for the canvas and have their own,
// much lighter header instead (see ProjectLayout.tsx's docblock for why).
export function WorkspaceLayout() {
  const result = useWorkspaceContext();
  const location = useLocation();
  const cache = useQueryClient();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const workspaceId = "workspace" in result ? result.workspace.id : undefined;
  const refresh = useCallback(() => {
    if (workspaceId) {
      void cache.invalidateQueries({ queryKey: qk.tickets(workspaceId) });
      void cache.invalidateQueries({ queryKey: qk.dashboard(workspaceId) });
      void cache.invalidateQueries({ queryKey: qk.activity(workspaceId) });
    }
  }, [cache, workspaceId]);
  useWSEvent("comment.created", refresh);
  useWSEvent("comment.updated", refresh);
  useWSEvent("comment.deleted", refresh);

  const connStatus = useConnectionStore((s) => s.status);

  useEffect(() => {
    setMobileNavigationOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileNavigationOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavigationOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileNavigationOpen]);

  if (result.status === "loading") {
    return <LoadingScreen />;
  }
  if (result.status === "not-found") {
    return <Navigate to="/" replace />;
  }
  if (result.status === "error") {
    return <main className="bl-review-gate"><h1>Could not open workspace</h1><p role="alert">{result.message}</p><button onClick={() => window.location.reload()}>Retry</button><Link to="/">Choose another workspace</Link></main>;
  }
  if (result.status === "switching") {
    return <LoadingScreen label={`Opening ${result.workspace.name}`} />;
  }

  const { workspace } = result;

  return (
    <div className="bl-app">
      <a className="bl-skip-link" href="#workspace-content">Skip to content</a>
      <DashboardSidebar
        workspace={workspace}
        mobileOpen={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
        onNavigate={() => setMobileNavigationOpen(false)}
      />
      {mobileNavigationOpen && (
        <button
          type="button"
          className="bl-nav-scrim"
          aria-label="Close workspace navigation"
          onClick={() => setMobileNavigationOpen(false)}
        />
      )}
      <div className="bl-main">
        <header className="bl-topbar">
          <button
            type="button"
            className="bl-mobile-menu-button"
            aria-label="Open workspace navigation"
            aria-controls="workspace-navigation"
            aria-expanded={mobileNavigationOpen}
            onClick={() => setMobileNavigationOpen(true)}
          >
            {mobileNavigationOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <span className="bl-mobile-brand"><BrandMark compact /></span>
          <GlobalSearch key={workspace.id} workspaceId={workspace.id} workspaceSlug={workspace.slug} />
          <div className="bl-topbar-actions">
            <button type="button" className="bl-button bl-topbar-create" onClick={() => setCreateProjectOpen(true)}>
              <PlusIcon /> <span>New project</span>
            </button>
            <NotificationBell />
            <AccountButton />
          </div>
        </header>
        {connStatus !== "connected" && (
          <div
            className={`bl-conn-banner ${connStatus === "reconnecting" ? "reconnecting" : "offline"}`}
            aria-live="polite"
            role="status"
          >
            {connStatus === "reconnecting"
              ? "Reconnecting to Backline…"
              : "You are offline. Changes may not be saved."}
          </div>
        )}
        <div id="workspace-content" className="bl-route-content" tabIndex={-1}>
          {location.pathname !== `/w/${workspace.slug}` && <nav aria-label="Breadcrumb" className="bl-mono"><Link to={`/w/${workspace.slug}`}>{workspace.name}</Link> / <span aria-current="page">{location.pathname.split("/").pop()?.replace(/-/g, " ")}</span></nav>}
          <Outlet context={{ workspace }} />
        </div>
      </div>
      {createProjectOpen && <ProjectForm workspace={workspace} onClose={() => setCreateProjectOpen(false)} />}
    </div>
  );
}
