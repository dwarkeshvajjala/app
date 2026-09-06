import { useQuery } from "@tanstack/react-query";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthContext";
import { getDashboard } from "../../features/tickets/api";
import type { WorkspaceOut } from "../../features/workspaces/api";
import { qk } from "../../lib/query-keys";
import { STATUS_COLORS, STATUS_LABELS, WORKFLOW_STATUSES } from "../../lib/workflow";

export function DashboardSidebar({ workspace, onSignOut }: { workspace: WorkspaceOut; onSignOut: () => void }) {
  const base = `/w/${workspace.slug}`;
  const location = useLocation();
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: qk.dashboard(workspace.id), queryFn: () => getDashboard(workspace.id) });
  const links = [
    { to: base, label: "Projects", icon: "▦", count: data?.projects },
    { to: `${base}/tickets?view=mine`, label: "Assigned to me", icon: "↳", count: data?.assigned_to_me },
    { to: `${base}/tickets`, label: "All tickets", icon: "☷", count: data?.tickets },
    { to: `${base}/activity`, label: "Activity", icon: "◷" },
    { to: `${base}/clients`, label: "Clients", icon: "♧" },
  ];
  function active(to: string) { return location.pathname + location.search === to; }
  return <aside className="bl-rail">
    <Link to="/" className="bl-workspace" aria-label="Switch workspace"><span className="bl-mark">{workspace.name.slice(0, 1)}</span><span><strong>{workspace.name}</strong><small>{data?.projects ?? "—"} projects · Workspace</small></span><span>⌄</span></Link>
    <nav aria-label="Workspace navigation" className="bl-nav">
      {links.map((item) => <Link key={item.label} className={active(item.to) ? "is-on" : ""} to={item.to}><span aria-hidden="true" className="bl-nav-icon">{item.icon}</span><span>{item.label}</span>{item.count !== undefined && <b className="bl-count">{item.count}</b>}</Link>)}
      <p className="bl-eyebrow">Comments by status</p>
      {WORKFLOW_STATUSES.filter((s) => s !== "wont_fix").map((s) => <Link key={s} className={active(`${base}/tickets?status=${s}`) ? "is-on" : ""} to={`${base}/tickets?status=${s}`}><i className="bl-dot" style={{ background: STATUS_COLORS[s] }} /><span>{STATUS_LABELS[s]}</span><b className="bl-count">{data?.statuses[s] ?? 0}</b></Link>)}
      <p className="bl-eyebrow">Projects</p>
      <Link to={`${base}?archived=true`} className={active(`${base}?archived=true`) ? "is-on" : ""}><i className="bl-dot" /><span>Archived</span><b className="bl-count">{data?.archived_projects ?? 0}</b></Link>
      <p className="bl-eyebrow">Workspace</p>
      {[['members', 'Members'], ['integrations', 'Integrations'], ['settings', 'Settings']].map(([path, label]) => <NavLink key={path} to={`${base}/${path}`} className={({ isActive }) => isActive ? "is-on" : ""}>{label}</NavLink>)}
    </nav>
    <footer className="bl-rail-footer"><div className="bl-plan"><strong className="capitalize">{workspace.plan} plan</strong><span className="bl-mono">{data?.projects ?? "—"} active projects</span><p>One place for your team's client reviews.</p><Link className="bl-button mint" to={`${base}/billing`}>Compare plans</Link></div><div className="bl-account"><span>{user?.name || "Your account"}</span><button onClick={onSignOut}>Sign out</button></div></footer>
  </aside>;
}
