import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { qk } from "../../lib/query-keys";
import { timeAgo } from "../../lib/time";
import { listClients } from "../clients/api";
import { NotificationBell } from "../notifications/NotificationBell";
import { getDashboard, listTickets } from "../tickets/api";
import { ShareProjectModal } from "../workspaces/ShareProjectModal";
import type { WorkspaceOut } from "../workspaces/api";
import * as api from "./api";
import { ProjectForm } from "./ProjectForm";

export function ProjectsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [create, setCreate] = useState(false);
  const [share, setShare] = useState<api.ProjectOut | null>(null);
  const [edit, setEdit] = useState<api.ProjectOut | null>(null);
  const [archive, setArchive] = useState<api.ProjectOut | null>(null);
  const archived = params.get("archived") === "true", search = params.get("search") ?? "", type = params.get("type") ?? "all", view = params.get("display") ?? "cards", sort = params.get("sort") ?? "activity";
  function filter(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); setParams(next); }
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => api.listProjects(workspace.id, true) });
  const clients = useQuery({ queryKey: qk.clients(workspace.id), queryFn: () => listClients(workspace.id) });
  const summary = useQuery({ queryKey: qk.dashboard(workspace.id), queryFn: () => getDashboard(workspace.id) });
  const attention = useQuery({ queryKey: [...qk.tickets(workspace.id), "attention"], queryFn: () => listTickets(workspace.id, new URLSearchParams({ view: "reply", limit: "3" })) });
  const stats = useMemo(() => new Map(summary.data?.project_stats.map((s) => [s.project_id, s]) ?? []), [summary.data]);
  const visible = useMemo(() => (projects.data ?? []).filter((p) => Boolean(p.archived_at) === archived && (type === "all" || (p.project_type ?? "website") === type) && (!params.get("client") || p.client_id === params.get("client")) && `${p.name} ${p.target_origin}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "open" ? (stats.get(b.id)?.open ?? 0) - (stats.get(a.id)?.open ?? 0) : sort === "added" ? b.created_at.localeCompare(a.created_at) : (stats.get(b.id)?.last_activity_at ?? b.updated_at).localeCompare(stats.get(a.id)?.last_activity_at ?? a.updated_at)), [projects.data, archived, type, params, search, sort, stats]);
  const changeArchive = useMutation({ mutationFn: async (p: api.ProjectOut) => { if (p.archived_at) await api.restoreProject(p.id); else await api.archiveProject(p.id); }, onSuccess: async () => { await cache.invalidateQueries({ queryKey: qk.workspace(workspace.id) }); setArchive(null); } });
  return <>
    <div className="bl-topbar"><label className="bl-search"><span aria-hidden="true">⌕</span><input aria-label="Search projects" placeholder="Search projects or URLs…" value={search} onChange={(e) => filter("search", e.target.value)} /></label><NotificationBell /><button className="bl-button" onClick={() => setCreate(true)}>＋ New project</button></div>
    <main className="bl-wrap"><header className="bl-head"><div><p className="bl-eyebrow">Your workspace</p><h1>{archived ? "Archived projects" : "Projects"}</h1><p>{archived ? "Finished for now. Restore a project to review it again." : "Every website, image and document. All the feedback in one place."}</p></div><time className="bl-mono">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</time></header>
      {!archived && (attention.data?.items.length ?? 0) > 0 && <section className="bl-attention"><header><h2>Waiting on you <span className="bl-count">{attention.data?.total}</span></h2><Link to={`/w/${workspace.slug}/tickets?view=reply`}>View all →</Link></header><div>{attention.data?.items.map((t) => <Link key={t.id} to={`/w/${workspace.slug}/tickets?ticket=${t.id}&project_id=${t.project_id}`}><small>{t.project_name} · {t.page_title}</small><strong>{t.body}</strong><span>{t.author_name} · {timeAgo(t.created_at)}</span></Link>)}</div></section>}
      <div className="bl-tabs" aria-label="Project types">{[['all', 'All projects'], ['website', 'Website'], ['image', 'Images'], ['pdf', 'PDF']].map(([key, label]) => <button key={key} aria-pressed={type === key} onClick={() => filter("type", key)}>{label}<span className="bl-count">{(projects.data ?? []).filter((p) => Boolean(p.archived_at) === archived && (key === "all" || (p.project_type ?? "website") === key)).length}</span></button>)}<Link to={`/w/${workspace.slug}/apps`}>Web App <small>Soon</small></Link><Link to={`/w/${workspace.slug}/mobile`}>Mobile <small>Soon</small></Link></div>
      <div className="bl-toolbar"><span className="bl-mono">{visible.length} PROJECTS</span><select aria-label="Filter by client" className="bl-select" value={params.get("client") ?? ""} onChange={(e) => filter("client", e.target.value)}><option value="">All clients</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="bl-tool-right"><select className="bl-select" aria-label="Sort projects" value={sort} onChange={(e) => filter("sort", e.target.value)}><option value="activity">Last activity</option><option value="added">Recently added</option><option value="open">Most open comments</option><option value="name">Name A–Z</option></select><div className="bl-segment">{['cards', 'compact', 'list', 'table'].map((v) => <button key={v} aria-pressed={view === v} onClick={() => filter("display", v)}>{v}</button>)}</div></div></div>
      {projects.isLoading && <p role="status">Loading projects…</p>}{projects.error && <p className="bl-error" role="alert">{projects.error.message}</p>}{summary.error && <p className="bl-error" role="alert">Project counts could not load: {summary.error.message}</p>}
      <div className={`bl-projects ${view}`}>{visible.map((p) => <article key={p.id} className={`bl-project ${p.archived_at ? 'archived' : ''}`}>
        <div className="bl-project-preview"><div className="bl-browser"><span>● ● ●</span><span>{p.project_type === "website" ? p.target_origin.replace(/^https?:\/\//, '') : p.project_type === "pdf" ? "PDF document" : "Image set"}</span></div><div className="bl-project-letter" aria-hidden="true">{p.name.slice(0, 1).toUpperCase()}</div><span className="bl-preview-type">{p.project_type ?? "website"}</span></div>
        <div className="bl-project-body"><div className="bl-project-title">{p.archived_at ? <h2>{p.name}</h2> : <Link to={`/w/${workspace.slug}/p/${p.id}`}><h2>{p.name}</h2></Link>}<span className="bl-chip">{p.archived_at ? "Archived" : p.environment ?? "live"}</span></div><p>{clients.data?.find((c) => c.id === p.client_id)?.name ?? "Internal project"}</p><div className="bl-project-stats"><Link to={`/w/${workspace.slug}/tickets?project_id=${p.id}`}><strong>{stats.get(p.id)?.open ?? 0}</strong> open</Link><span><strong>{stats.get(p.id)?.resolved ?? 0}</strong> resolved</span><small>{timeAgo(stats.get(p.id)?.last_activity_at ?? p.updated_at)}</small></div></div>
        <footer className="bl-project-actions">{!p.archived_at && <><Link to={`/w/${workspace.slug}/p/${p.id}`}>Open project ↗</Link><button onClick={() => setShare(p)}>Share</button><button onClick={() => setEdit(p)}>Settings</button></>}<button onClick={() => setArchive(p)}>{p.archived_at ? "Restore" : "Archive"}</button></footer>
      </article>)}{!archived && !search && type === "all" && <button className="bl-new-card" onClick={() => setCreate(true)}><span>＋</span><strong>New project</strong><small>Bring your next review here</small></button>}</div>
      {!projects.isLoading && !projects.error && visible.length === 0 && <div className="bl-empty"><h2>{archived ? "No archived projects" : "No projects here yet"}</h2><p>{search || type !== "all" ? "Try a different search or project type." : "Create a project to get a shareable review link."}</p></div>}
    </main>
    {create && <ProjectForm workspace={workspace} onClose={() => setCreate(false)} />}{edit && <ProjectForm workspace={workspace} project={edit} onClose={() => setEdit(null)} />}
    {share && <ShareProjectModal project={share} workspaceId={workspace.id} workspaceSlug={workspace.slug} workspaceName={workspace.name} onClose={() => setShare(null)} />}
    {archive && <Dialog title={`${archive.archived_at ? "Restore" : "Archive"} ${archive.name}?`} onClose={() => setArchive(null)}><div className="bl-form"><p>{archive.archived_at ? "The project and its review links will be available again." : "Review links will stop accepting reviews. Your comments and files are retained, and you can restore the project."}</p>{changeArchive.error && <p role="alert" className="bl-error">{changeArchive.error.message}</p>}<button className="bl-button" disabled={changeArchive.isPending} onClick={() => changeArchive.mutate(archive)}>{archive.archived_at ? "Restore project" : "Archive project"}</button></div></Dialog>}
  </>;
}
