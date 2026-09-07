import type { Schemas } from "@backline/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../../lib/use-document-title";
import { downloadCsv } from "../../lib/csv";
import { invalidateTicketsAndDashboard, qk } from "../../lib/query-keys";
import { STATUS_LABELS, TAGS, WORKFLOW_STATUSES } from "../../lib/workflow";
import { updateComment } from "../board/api";
import { listProjects } from "../projects/api";
import { listMembers } from "../workspaces/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as api from "./api";
import { StatusSelect } from "./components/StatusSelect";
import { TicketBoard } from "./components/TicketBoard";
import { TicketCalendar } from "./components/TicketCalendar";
import { NewTicket } from "./components/NewTicket";
import { TicketDetail } from "./components/TicketDetail";

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
  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Schemas["CommentUpdate"] }) => updateComment(id, patch), onSuccess: () => invalidateTicketsAndDashboard(cache, workspace.id) });

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
    {display === "board" ? <TicketBoard tickets={tickets} update={update} onOpen={(id) => set("ticket", id)} /> : display === "calendar" ? <TicketCalendar tickets={tickets} update={update} onOpen={(id) => set("ticket", id)} /> : groups.map(([label, rows]) => <section key={label}>{label && <h2 className="bl-group-title">{label} <span>{rows.length}</span></h2>}<div className={`bl-table-wrap bl-tickets ${display}`}><table className="bl-table"><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Tags</th><th>Assignees</th><th>Due date</th></tr></thead><tbody>{rows.map(row)}</tbody></table></div></section>)}
    {query.data?.total === 0 && <div className="bl-empty"><h2>Nothing here</h2><p>No tickets match these filters. Clear them or raise a new team ticket.</p></div>}
    {query.data && query.data.total > 0 && <div className="bl-pagination"><button disabled={offset === 0} onClick={() => set("offset", String(Math.max(0, offset - 50)))}>Previous</button><span>Showing {offset + 1}–{Math.min(offset + 50, query.data.total)} of {query.data.total}</span><button disabled={offset + 50 >= query.data.total} onClick={() => set("offset", String(offset + 50))}>Next</button></div>}
    {showCreate && <NewTicket workspace={workspace} members={members.data ?? []} onClose={() => setShowCreate(false)} />}
    {selected && <TicketDetail id={selected} workspace={workspace} members={members.data ?? []} onClose={() => set("ticket", "")} />}
  </main>;
}
