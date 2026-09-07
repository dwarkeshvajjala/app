import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { useTranslation } from "react-i18next";
import type { TranslationKeys } from "../../lib/i18n";
import { AccountModal } from "../../features/auth/AccountModal";
import { getDashboard } from "../../features/tickets/api";
import type { WorkspaceOut } from "../../features/workspaces/api";
import { WorkspaceSwitcherPopover } from "../../features/workspaces/WorkspaceSwitcherPopover";
import { qk } from "../../lib/query-keys";
import { STATUS_COLORS, STATUS_LABELS, WORKFLOW_STATUSES } from "../../lib/workflow";

export function DashboardSidebar({ workspace, onSignOut: _onSignOut }: { workspace: WorkspaceOut; onSignOut: () => void }) {
  const base = `/w/${workspace.slug}`;
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: qk.dashboard(workspace.id), queryFn: () => getDashboard(workspace.id) });
  const links = [
    { to: base, label: t('sidebar.projects' as TranslationKeys), icon: "▦", count: data?.projects },
    { to: `${base}/tickets?view=mine`, label: "Assigned to me", icon: "↳", count: data?.assigned_to_me },
    { to: `${base}/tickets`, label: t('sidebar.tickets' as TranslationKeys), icon: "☷", count: data?.tickets },
    { to: `${base}/activity`, label: t('sidebar.activity' as TranslationKeys), icon: "◷" },
    { to: `${base}/clients`, label: t('sidebar.clients' as TranslationKeys), icon: "♧" },
  ];
  function active(to: string) { return location.pathname + location.search === to; }

  const [showWsPop, setShowWsPop] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  return <aside className="bl-rail">
    {/* Workspace switcher trigger */}
    <div style={{ position: "relative" }}>
      <button
        type="button"
        className="bl-workspace bl-ws-trigger"
        aria-label="Switch workspace"
        aria-haspopup="dialog"
        aria-expanded={showWsPop}
        onClick={() => setShowWsPop((v) => !v)}
      >
        <span className="bl-mark">{workspace.name.slice(0, 1)}</span>
        <span><strong>{workspace.name}</strong><small>{data?.projects ?? "—"} projects · Workspace</small></span>
        <span aria-hidden="true">⌄</span>
      </button>
      {showWsPop && (
        <WorkspaceSwitcherPopover
          currentWorkspace={workspace}
          onClose={() => setShowWsPop(false)}
        />
      )}
    </div>

    <nav aria-label="Workspace navigation" className="bl-nav">
      {links.map((item) => <NavLink key={item.label} className={active(item.to) ? "is-on" : ""} to={item.to}><span aria-hidden="true" className="bl-nav-icon">{item.icon}</span><span>{item.label}</span>{item.count !== undefined && <b className="bl-count">{item.count}</b>}</NavLink>)}
      <p className="bl-eyebrow">Comments by status</p>
      {WORKFLOW_STATUSES.filter((s) => s !== "wont_fix").map((s) => <NavLink key={s} className={active(`${base}/tickets?status=${s}`) ? "is-on" : ""} to={`${base}/tickets?status=${s}`}><i className="bl-dot" style={{ background: STATUS_COLORS[s] }} /><span>{STATUS_LABELS[s]}</span><b className="bl-count">{data?.statuses[s] ?? 0}</b></NavLink>)}
      <p className="bl-eyebrow">Projects</p>
      <NavLink to={`${base}?archived=true`} className={active(`${base}?archived=true`) ? "is-on" : ""}><i className="bl-dot" /><span>Archived</span><b className="bl-count">{data?.archived_projects ?? 0}</b></NavLink>
      <p className="bl-eyebrow">Workspace</p>
      {[['members', 'Members'], ['integrations', 'Integrations'], ['settings', 'Settings']].map(([path, label]) => <NavLink key={path} to={`${base}/${path}`} className={({ isActive }) => isActive ? "is-on" : ""}>{label}</NavLink>)}
    </nav>
    <footer className="bl-rail-footer">
      <div className="bl-plan"><strong className="capitalize">{workspace.plan} plan</strong><span className="bl-mono">{data?.projects ?? "—"} active projects</span><p>One place for your team's client reviews.</p><NavLink className="bl-button mint" to={`${base}/billing`}>Compare plans</NavLink></div>
      <div className="bl-account">
        <button
          type="button"
          className="bl-quiet"
          style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          aria-label="Open account settings"
          onClick={() => setShowAccount(true)}
        >
          {user?.name || "Your account"}
        </button>
      </div>
    </footer>
    {showAccount && <AccountModal onClose={() => setShowAccount(false)} />}
  </aside>;
}
