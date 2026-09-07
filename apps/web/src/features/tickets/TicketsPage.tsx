import type { Schemas } from "@backline/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../../lib/use-document-title";
import { Dialog } from "../../components/Dialog";
import { downloadCsv } from "../../lib/csv";
import { qk } from "../../lib/query-keys";
import { isClosed, STATUS_COLORS, STATUS_LABELS, TAGS, WORKFLOW_STATUSES } from "../../lib/workflow";
import { listProjectComments, updateComment, createReply } from "../board/api";
import { listProjects } from "../projects/api";
import { listMembers } from "../workspaces/api";
import type { WorkspaceOut, MemberOut } from "../workspaces/api";
import * as api from "./api";

export function TicketsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  useDocumentTitle('Tickets');
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const display = params.get("display") ?? "list", group = params.get("group") ?? "none";
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const request = new URLSearchParams();
  for (const key of ['search', 'status', 'project_id', 'priority', 'tag', 'view', 'sort']) { 
    const value = params.get(key); 
    if (value) request.set(key, value); 
  }
  for (const a of params.getAll("assignee")) {
    request.append("assignee", a);
  }
  request.set("offset", String(offset)); request.set("limit", "50");
  const query = useQuery({ queryKey: [...qk.tickets(workspace.id), request.toString()], queryFn: () => api.listTickets(workspace.id, request) });
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(workspace.id, true) });
  const members = useQuery({ queryKey: qk.members(workspace.id), queryFn: () => listMembers(workspace.id) });
  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Schemas["CommentUpdate"] }) => updateComment(id, patch), onSuccess: () => cache.invalidateQueries({ queryKey: qk.workspace(workspace.id) }) });
  
  function set(key: string, value: string | string[]) { 
    const next = new URLSearchParams(params); 
    if (Array.isArray(value)) {
      next.delete(key);
      value.forEach(v => next.append(key, v));
    } else if (value) {
      next.set(key, value); 
    } else {
      next.delete(key); 
    }
    if (key !== "offset" && key !== "ticket") next.delete("offset"); 
    setParams(next); 
  }

  const tickets = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const groups = useMemo(() => {
    const result = new Map<string, api.Ticket[]>();
    for (const ticket of tickets) {
      const keys = group === "status" ? [STATUS_LABELS[ticket.status]] : group === "project" ? [ticket.project_name] : group === "priority" ? [ticket.priority ?? "medium"] : group === "tag" ? ticket.tags?.length ? ticket.tags : ["No tags"] : group === "assignee" ? ticket.assignee_ids?.length ? ticket.assignee_ids.map((id) => members.data?.find((m) => m.user_id === id)?.name ?? "Former member") : ["Unassigned"] : [""];
      for (const key of keys) result.set(key, [...(result.get(key) ?? []), ticket]);
    }
    return [...result];
  }, [tickets, group, members.data]);
  async function exportAll() {
    setExporting(true); setExportError("");
    try {
      const rows: api.Ticket[] = [];
      for (let start = 0; ; start += 100) { const p = new URLSearchParams(request); p.set("offset", String(start)); p.set("limit", "100"); const page = await api.listTickets(workspace.id, p); rows.push(...page.items); if (start + page.items.length >= page.total || !page.items.length) break; }
      downloadCsv([["Project", "Ticket", "Status", "Priority", "Due", "Tags", "Assignees"], ...rows.map((t) => [t.project_name, t.body, STATUS_LABELS[t.status], t.priority, t.due_at?.slice(0, 10), t.tags?.join(", "), t.assignee_ids?.map((id) => members.data?.find((m) => m.user_id === id)?.name ?? id).join(", ")])], "backline-tickets.csv");
    } catch (error) { setExportError(error instanceof Error ? error.message : "Could not export tickets."); } finally { setExporting(false); }
  }
  function row(t: api.Ticket) { return <tr key={t.id}><td><button className="bl-ticket-title" onClick={() => set("ticket", t.id)}>{t.body}</button><small>{t.project_name} · {t.is_standalone ? "Team ticket" : t.page_title}</small></td><td><StatusSelect ticket={t} disabled={update.isPending} onChange={(status) => update.mutate({ id: t.id, patch: { status } })} /></td><td><select className="bl-select" aria-label={`Priority for ${t.body.slice(0, 40)}`} disabled={update.isPending} value={t.priority ?? "medium"} onChange={(e) => update.mutate({ id: t.id, patch: { priority: e.target.value as "high" | "medium" | "low" } })}>{['high', 'medium', 'low'].map((p) => <option key={p}>{p}</option>)}</select></td><td><div className="bl-chip-row">{t.tags?.map((tag) => <button className="bl-chip" key={tag} onClick={() => set("tag", tag)}>{tag}</button>)}</div></td><td><button className="bl-quiet" onClick={() => set("ticket", t.id)}>{t.assignee_ids?.length ? t.assignee_ids.map((id) => members.data?.find((m) => m.user_id === id)?.name ?? "Former member").join(", ") : "Unassigned"}</button></td><td><input type="date" className="bl-date" aria-label={`Due date for ${t.body.slice(0, 40)}`} value={t.due_at?.slice(0, 10) ?? ""} disabled={update.isPending} onChange={(e) => update.mutate({ id: t.id, patch: { due_at: e.target.value ? `${e.target.value}T00:00:00Z` : null } })} /></td></tr>; }
  const selected = params.get("ticket");
  return <main className="bl-wrap"><header className="bl-head"><div><p className="bl-eyebrow">Across your projects</p><h1>{params.get("view") === "mine" ? "Assigned to me" : "All tickets"}</h1><p>Every comment, plus the work your team raises directly.</p></div><div className="bl-chip-row"><button className="bl-quiet" disabled={exporting} onClick={() => void exportAll()}>{exporting ? "Exporting…" : "Export CSV"}</button><button className="bl-button" onClick={() => setShowCreate(true)}>＋ New ticket</button></div></header>
    <div className="bl-tabs">{[['all', 'Everyone'], ['mine', 'Assigned to me'], ['reply', 'Needs your reply'], ['client', 'Waiting on client'], ['overdue', 'Overdue']].map(([key, label]) => <button key={key} aria-pressed={(params.get("view") ?? "all") === key} onClick={() => set("view", key)}>{label}</button>)}</div>
    <div className="bl-toolbar wrap">
      <input className="bl-input" aria-label="Search tickets" placeholder="Search tickets or projects…" value={params.get("search") ?? ""} onChange={(e) => set("search", e.target.value)} />
      <select className="bl-select" aria-label="Filter ticket status" value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
        <option value="">All statuses</option>
        {WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
      <select className="bl-select" aria-label="Filter ticket project" value={params.get("project_id") ?? ""} onChange={(e) => set("project_id", e.target.value)}>
        <option value="">All projects</option>
        {projects.data?.filter((p) => !p.archived_at).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <select 
        multiple
        className="bl-select" 
        style={{ height: 'auto', minHeight: '38px' }}
        aria-label="Filter ticket assignee" 
        value={params.getAll("assignee")} 
        onChange={(e) => set("assignee", Array.from(e.target.selectedOptions).map(o => o.value))}
      >
        <option value="unassigned">Unassigned</option>
        {members.data?.map((m) => <option key={m.user_id} value={m.user_id}>{m.name || m.email}</option>)}
      </select>
      <select className="bl-select" aria-label="Filter priority" value={params.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value)}>
        <option value="">All priorities</option>
        {['high', 'medium', 'low'].map((p) => <option key={p}>{p}</option>)}
      </select>
      <select className="bl-select" aria-label="Filter tag" value={params.get("tag") ?? ""} onChange={(e) => set("tag", e.target.value)}>
        <option value="">All tags</option>
        {TAGS.map((t) => <option key={t}>{t}</option>)}
      </select>
      <button className="bl-quiet" onClick={() => {
        const next = new URLSearchParams();
        next.set("view", params.get("view") || "all");
        next.set("display", params.get("display") || "list");
        setParams(next);
      }}>Clear filters</button>
    </div>
    {params.getAll("assignee").length > 0 && (
      <div className="bl-chip-row" style={{ padding: '0 1rem 1rem' }}>
        <span className="bl-eyebrow">Assignees:</span>
        {params.getAll("assignee").map(a => (
          <button 
            key={a} 
            className="bl-chip" 
            onClick={() => set("assignee", params.getAll("assignee").filter(x => x !== a))}
            aria-label={`Remove assignee filter ${a}`}
          >
            {a === "unassigned" ? "Unassigned" : members.data?.find(m => m.user_id === a)?.name ?? a} ✕
          </button>
        ))}
        <button className="bl-quiet" style={{ fontSize: '11px', padding: 0 }} onClick={() => set("assignee", [])}>
          Clear all
        </button>
      </div>
    )}
    <div className="bl-toolbar"><span className="bl-mono">{query.data?.total ?? "—"} TICKETS</span><div className="bl-tool-right"><select className="bl-select" aria-label="Sort tickets" value={params.get("sort") ?? "newest"} onChange={(e) => set("sort", e.target.value)}>{[['newest','Newest'],['oldest','Oldest'],['due','Due date'],['priority','Priority'],['status','Status'],['project','Project']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>{(display === "list" || display === "table") && <select className="bl-select" aria-label="Group tickets" value={group} onChange={(e) => set("group", e.target.value)}>{['none', 'status', 'project', 'assignee', 'priority', 'tag'].map((g) => <option key={g} value={g}>{g === "none" ? "No grouping" : `Group by ${g}`}</option>)}</select>}<div className="bl-segment">{['list', 'board', 'table', 'calendar'].map((v) => <button key={v} aria-pressed={display === v} onClick={() => set("display", v)}>{v}</button>)}</div></div></div>
    {query.isLoading && <p role="status">Loading tickets…</p>}{[query.error?.message, update.error?.message, exportError].filter(Boolean).map((error) => <p key={error} className="bl-error" role="alert">{error}</p>)}
    {display === "board" ? <TicketBoard tickets={tickets} update={update} onOpen={(id) => set("ticket", id)} /> : display === "calendar" ? <TicketCalendar tickets={tickets} onOpen={(id) => set("ticket", id)} /> : groups.map(([label, rows]) => <section key={label}>{label && <h2 className="bl-group-title">{label} <span>{rows.length}</span></h2>}<div className={`bl-table-wrap bl-tickets ${display}`}><table className="bl-table"><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Tags</th><th>Assignees</th><th>Due date</th></tr></thead><tbody>{rows.map(row)}</tbody></table></div></section>)}
    {query.data?.total === 0 && <div className="bl-empty"><h2>Nothing here</h2><p>No tickets match these filters. Clear them or raise a new team ticket.</p></div>}
    {query.data && query.data.total > 0 && <div className="bl-pagination"><button disabled={offset === 0} onClick={() => set("offset", String(Math.max(0, offset - 50)))}>Previous</button><span>Showing {offset + 1}–{Math.min(offset + 50, query.data.total)} of {query.data.total}</span><button disabled={offset + 50 >= query.data.total} onClick={() => set("offset", String(offset + 50))}>Next</button></div>}
    {showCreate && <NewTicket workspace={workspace} members={members.data ?? []} onClose={() => setShowCreate(false)} />}
    {selected && <TicketDetail id={selected} workspace={workspace} members={members.data ?? []} onClose={() => set("ticket", "")} />}
  </main>;
}

function TicketBoard({ tickets, update, onOpen }: { tickets: api.Ticket[]; update: any; onOpen: (id: string) => void }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  return (
    <div className="bl-board">
      {WORKFLOW_STATUSES.map((s) => (
        <section
          key={s}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.setAttribute('data-dragover', 'true');
          }}
          onDragLeave={(e) => {
            e.currentTarget.removeAttribute('data-dragover');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.removeAttribute('data-dragover');
            const id = e.dataTransfer.getData("text/plain");
            if (id && id !== draggedId) {
              const ticket = tickets.find(t => t.id === id);
              if (ticket && ticket.status !== s) {
                update.mutate({ id, patch: { status: s } });
              }
            }
            setDraggedId(null);
          }}
        >
          <h2>
            <i className="bl-dot" style={{ background: STATUS_COLORS[s] }} />
            {STATUS_LABELS[s]} <span>{tickets.filter((t) => t.status === s).length}</span>
          </h2>
          {tickets
            .filter((t) => t.status === s)
            .map((t) => (
              <article
                key={t.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", t.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedId(t.id);
                  // small timeout to allow drag image to render before styling source
                  setTimeout(() => e.target && (e.target as HTMLElement).classList.add("bl-dragging"), 0);
                }}
                onDragEnd={(e) => {
                  setDraggedId(null);
                  e.currentTarget.classList.remove("bl-dragging");
                }}
              >
                <small>{t.project_name}</small>
                <button className="bl-ticket-title" onClick={() => onOpen(t.id)}>
                  {t.body}
                </button>
                <div className="bl-chip-row">
                  {t.tags?.map((tag) => (
                    <span className="bl-chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
                <StatusSelect
                  ticket={t}
                  disabled={update.isPending}
                  onChange={(status) => update.mutate({ id: t.id, patch: { status } })}
                />
              </article>
            ))}
        </section>
      ))}
    </div>
  );
}

function StatusSelect({ ticket, disabled, onChange }: { ticket: api.Ticket; disabled: boolean; onChange: (status: api.Ticket["status"]) => void }) {
  return <select className="bl-status-select" style={{ borderLeftColor: STATUS_COLORS[ticket.status] }} aria-label={`Status for ${ticket.body.slice(0, 40)}`} value={ticket.status} disabled={disabled} onChange={(e) => onChange(e.target.value as api.Ticket["status"])}>{WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select>;
}

function TicketCalendar({ tickets, onOpen }: { tickets: api.Ticket[]; onOpen: (id: string) => void }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const first = new Date(month.getFullYear(), month.getMonth(), 1), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + days) / 7) * 7 }, (_, i) => i - first.getDay() + 1);
  return <section><div className="bl-toolbar"><button className="bl-quiet" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button><h2 id="calendar-heading">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2><button className="bl-quiet" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button><span className="bl-mono">Dates from the current results page</span></div><div className="bl-calendar" role="grid" aria-labelledby="calendar-heading"><div role="row">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => <strong key={d} role="columnheader">{d}</strong>)}</div>{Array.from({ length: cells.length / 7 }).map((_, weekIndex) => <div key={weekIndex} role="row">{cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, i) => { const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2,'0')}`; const valid = day >= 1 && day <= days; return <div key={i} className={valid ? '' : 'outside'} role="gridcell" aria-label={valid ? key : undefined}>{valid && <><span>{day}</span>{tickets.filter((t) => t.due_at?.slice(0,10) === key).map((t) => <button key={t.id} onClick={() => onOpen(t.id)} style={{ borderLeftColor: STATUS_COLORS[t.status] }} aria-label={`View ticket: ${t.body}`}>{t.body}</button>)}</>}</div>; })}</div>)}</div><h2 className="bl-group-title">No due date</h2><div className="bl-chip-row">{tickets.filter((t) => !t.due_at).map((t) => <button className="bl-chip" key={t.id} onClick={() => onOpen(t.id)} aria-label={`View ticket: ${t.body.slice(0,70)}`}>{t.body.slice(0,70)}</button>)}</div></section>;
}

function NewTicket({ workspace, members, onClose }: { workspace: WorkspaceOut; members: MemberOut[]; onClose: () => void }) {
  const cache = useQueryClient();
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(workspace.id, true) });
  const [projectId, setProjectId] = useState("");
  const [body, setBody] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const save = useMutation({ mutationFn: () => api.createTicket(projectId, { body, status: "todo", priority, assignee_ids: assignees }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: qk.workspace(workspace.id) }); await cache.invalidateQueries({ queryKey: qk.projectComments(projectId) }); onClose(); } });
  return <Dialog title="New team ticket" onClose={onClose}><form className="bl-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><p>Raise work for your team without pinning it to a page.</p><label>Project<select className="bl-input" required value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Choose a project</option>{projects.data?.filter((p) => !p.archived_at).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>What needs to change?<textarea className="bl-input" required rows={4} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} /></label><label>Priority<select className="bl-input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>{['high','medium','low'].map((p) => <option key={p}>{p}</option>)}</select></label><PeoplePicker label="Assignees" members={members} selected={assignees} onChange={setAssignees} />{save.error && <p role="alert" className="bl-error">{save.error.message}</p>}<button className="bl-button" disabled={save.isPending || !projectId || !body.trim()}>{save.isPending ? "Creating…" : "Create ticket"}</button></form></Dialog>;
}

function PeoplePicker({ label, members, selected, onChange }: { label: string; members: MemberOut[]; selected: string[]; onChange: (value: string[]) => void }) {
  return <fieldset className="bl-people"><legend>{label}</legend>{members.map((m) => <label key={m.user_id}><input type="checkbox" checked={selected.includes(m.user_id)} onChange={(e) => onChange(e.target.checked ? [...selected, m.user_id] : selected.filter((id) => id !== m.user_id))} />{m.name}</label>)}</fieldset>;
}

function TicketDetail({ id, workspace, members, onClose }: { id: string; workspace: WorkspaceOut; members: MemberOut[]; onClose: () => void }) {
  const ticket = useQuery({ queryKey: [...qk.tickets(workspace.id), "detail", id], queryFn: () => api.listTickets(workspace.id, new URLSearchParams({ comment_id: id, limit: "1" })) });
  const value = ticket.data?.items[0];
  return <Dialog title="Ticket details" onClose={onClose}>{ticket.isLoading && <p className="bl-form" role="status">Loading ticket…</p>}{ticket.error && <p className="bl-error" role="alert">{ticket.error.message}</p>}{value ? <TicketDetailForm key={value.id} ticket={value} workspace={workspace} members={members} /> : ticket.data && <p className="bl-form">Ticket not found in active projects.</p>}</Dialog>;
}

function TicketDetailForm({ ticket, workspace, members }: { ticket: api.Ticket; workspace: WorkspaceOut; members: MemberOut[] }) {
  const cache = useQueryClient();
  const [body, setBody] = useState(ticket.body), [reply, setReply] = useState("");
  const [patch, setPatch] = useState<Schemas["CommentUpdate"]>({ status: ticket.status, priority: ticket.priority, tags: ticket.tags ?? [], assignee_ids: ticket.assignee_ids ?? [], waiting_on_ids: ticket.waiting_on_ids ?? [], waiting_on_client: ticket.waiting_on_client ?? false, due_at: ticket.due_at });
  const [layer, setLayer] = useState<"team" | "client">(ticket.layer);
  const comments = useQuery({ queryKey: qk.projectComments(ticket.project_id), queryFn: () => listProjectComments(ticket.project_id) });
  async function refresh() { await cache.invalidateQueries({ queryKey: qk.workspace(workspace.id) }); await cache.invalidateQueries({ queryKey: qk.projectComments(ticket.project_id) }); }
  const save = useMutation({ mutationFn: () => updateComment(ticket.id, { ...patch, body }), onSuccess: refresh });
  const post = useMutation({ mutationFn: () => createReply(ticket.id, reply.trim(), layer), onSuccess: async () => { setReply(""); await refresh(); } });
  return <div className="bl-form"><div className="bl-chip-row"><span className="bl-chip">{ticket.project_name}</span><span className="bl-chip">{ticket.layer === "team" ? "Team only" : "Client visible"}</span>{!ticket.is_standalone && <Link className="bl-chip" to={`/w/${workspace.slug}/p/${ticket.project_id}?comment=${ticket.id}`}>Open on page ↗</Link>}</div>
    <form className="bl-form bl-flush" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><label>Ticket<textarea className="bl-input" rows={3} value={body} required onChange={(e) => setBody(e.target.value)} /></label><div className="bl-fields"><label>Status<select className="bl-input" value={patch.status ?? ticket.status} onChange={(e) => setPatch({ ...patch, status: e.target.value as api.Ticket["status"], ...(isClosed(e.target.value as api.Ticket["status"]) ? { waiting_on_ids: [], waiting_on_client: false } : {}) })}>{WORKFLOW_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}</select></label><label>Priority<select className="bl-input" value={patch.priority ?? "medium"} onChange={(e) => setPatch({ ...patch, priority: e.target.value as "high" | "medium" | "low" })}>{['high','medium','low'].map((p) => <option key={p}>{p}</option>)}</select></label><label>Due date<DatePicker value={patch.due_at} onChange={(d) => setPatch({ ...patch, due_at: d })} /></label></div><fieldset><legend>Tags</legend><div className="bl-chip-row">{TAGS.map((tag) => <label className="bl-chip" key={tag}><input type="checkbox" checked={patch.tags?.includes(tag) ?? false} onChange={(e) => setPatch({ ...patch, tags: e.target.checked ? [...(patch.tags ?? []), tag] : patch.tags?.filter((t) => t !== tag) })} />{tag}</label>)}</div></fieldset><PeoplePicker label="Assignees" members={members} selected={patch.assignee_ids ?? []} onChange={(assignee_ids) => setPatch({ ...patch, assignee_ids })} />{!isClosed(patch.status ?? ticket.status) && <><PeoplePicker label="Waiting for a reply from" members={members} selected={patch.waiting_on_ids ?? []} onChange={(waiting_on_ids) => setPatch({ ...patch, waiting_on_ids })} /><label className="bl-check"><input type="checkbox" checked={patch.waiting_on_client ?? false} onChange={(e) => setPatch({ ...patch, waiting_on_client: e.target.checked })} />Waiting on client</label></>}{save.error && <p className="bl-error" role="alert">{save.error.message}</p>}{save.isSuccess && <p role="status">Changes saved.</p>}<button className="bl-button" disabled={save.isPending || !body.trim()}>Save changes</button></form>
    {ticket.screenshot_url && <a href={ticket.screenshot_url} target="_blank" rel="noreferrer"><img className="bl-screenshot" src={ticket.screenshot_url} alt="Captured review context" /></a>}{ticket.attachments.map((a) => <a key={a.url} className="bl-chip" href={a.url} target="_blank" rel="noreferrer">{a.filename} ↗</a>)}<h2 className="bl-group-title">Conversation</h2>{comments.error && <p role="alert" className="bl-error">{comments.error.message}</p>}{comments.data?.filter((c) => c.parent_id === ticket.id).map((c) => <article className="bl-message" key={c.id}><small>{c.author_name} · {c.layer === "team" ? "Team only" : "Client visible"}</small><p>{c.body}</p>{c.attachments.map((a) => <a className="bl-chip" key={a.url} href={a.url} target="_blank" rel="noreferrer">{a.filename}</a>)}</article>)}<form className="bl-form bl-flush" onSubmit={(e) => { e.preventDefault(); post.mutate(); }}><label>Reply<textarea className="bl-input" required value={reply} onChange={(e) => setReply(e.target.value)} /></label><div className="bl-form-actions"><select aria-label="Reply visibility" className="bl-select" value={layer} onChange={(e) => setLayer(e.target.value as "team" | "client")}><option value="team">Team only</option>{ticket.layer === "client" && <option value="client">Client visible</option>}</select><button className="bl-button" disabled={post.isPending || !reply.trim()}>Post reply</button></div>{post.error && <p className="bl-error" role="alert">{post.error.message}</p>}</form>
  </div>;
}

function DatePicker({ value, onChange }: { value: string | null | undefined, onChange: (date: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => value ? new Date(value) : new Date());
  
  const handleDateSelect = (d: number) => {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2,'0')}T00:00:00Z`;
    onChange(key);
    setOpen(false);
  };
  
  const handleToday = () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2,'0')}T00:00:00Z`;
    onChange(key);
    setOpen(false);
  };
  
  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1), days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((first.getDay() + days) / 7) * 7 }, (_, i) => i - first.getDay() + 1);

  return (
    <div style={{ position: 'relative' }}>
      <button 
        type="button" 
        className="bl-input" 
        style={{ textAlign: 'left', minHeight: '38px', backgroundColor: '#fff', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        {value ? new Date(value).toLocaleDateString() : 'Select date...'}
      </button>
      {open && (
        <div 
          className="bl-popover" 
          style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, marginTop: '4px', background: 'white', border: '1px solid #ccc', borderRadius: '4px', padding: '1rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
        >
          <div className="bl-toolbar" style={{ marginBottom: '8px' }}>
            <button type="button" className="bl-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
            <strong style={{ margin: '0 8px' }}>{month.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</strong>
            <button type="button" className="bl-quiet" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
          </div>
          <div className="bl-calendar" role="grid" style={{ minHeight: 'auto', gap: '4px', marginBottom: '8px' }}>
            <div role="row">
              {['S','M','T','W','T','F','S'].map((d, i) => <strong key={i} role="columnheader" style={{ width: '28px', textAlign: 'center', display: 'inline-block' }}>{d}</strong>)}
            </div>
            {Array.from({ length: cells.length / 7 }).map((_, weekIndex) => (
              <div key={weekIndex} role="row">
                {cells.slice(weekIndex * 7, (weekIndex + 1) * 7).map((day, i) => {
                  const valid = day >= 1 && day <= days;
                  const isSelected = value && new Date(value).getDate() === day && new Date(value).getMonth() === month.getMonth() && new Date(value).getFullYear() === month.getFullYear();
                  return (
                    <button 
                      key={i} 
                      type="button"
                      disabled={!valid}
                      onClick={() => valid && handleDateSelect(day)}
                      style={{ 
                        width: '28px', height: '28px', border: 'none', background: isSelected ? '#000' : 'transparent', color: isSelected ? '#fff' : valid ? '#000' : '#ccc', borderRadius: '4px', cursor: valid ? 'pointer' : 'default'
                      }}
                      role="gridcell"
                    >
                      {valid ? day : ''}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="bl-form-actions" style={{ marginTop: '8px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
            <button type="button" className="bl-quiet" onClick={handleClear}>Clear</button>
            <button type="button" className="bl-button" onClick={handleToday}>Today</button>
          </div>
        </div>
      )}
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />}
    </div>
  );
}
