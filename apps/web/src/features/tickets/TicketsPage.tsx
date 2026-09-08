import type { Schemas } from "@backline/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../../lib/use-document-title";
import { downloadCsv } from "../../lib/csv";
import { invalidateTicketsAndDashboard, qk } from "../../lib/query-keys";
import { STATUS_LABELS, TAGS, WORKFLOW_STATUSES } from "../../lib/workflow";
import { PlusIcon } from "../../components/icons";
import { updateComment } from "../board/api";
import { listProjects } from "../projects/api";
import { listMembers } from "../workspaces/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as api from "./api";
import { TicketBoard } from "./components/TicketBoard";
import { TicketCalendar } from "./components/TicketCalendar";
import { TicketRow } from "./components/TicketRow";
import { TicketTable } from "./components/TicketTable";
import { TicketToolbar } from "./components/TicketToolbar";
import { NewTicket } from "./components/NewTicket";
import { TicketDetail } from "./components/TicketDetail";

const VIEW_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "mine", label: "Assigned to me" },
  { key: "reply", label: "Needs your reply" },
  { key: "client", label: "Waiting on client" },
  { key: "overdue", label: "Overdue" },
];

export function TicketsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  useDocumentTitle("Tickets");
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const display = params.get("display") ?? "list";
  const group = params.get("group") ?? "none";
  const sort = params.get("sort") ?? "newest";
  const assignees = params.getAll("assignee");
  const offset = Math.max(0, Number(params.get("offset")) || 0);
  const request = new URLSearchParams();
  for (const key of ["search", "status", "project_id", "priority", "tag", "view", "sort"]) {
    const value = params.get(key);
    if (value) request.set(key, value);
  }
  // The API takes a single assignee filter; a multi-person "show work for" pick
  // narrows to the first selection so results still reflect the URL's saved
  // filter honestly rather than silently dropping the rest.
  if (assignees.length) request.set("assignee", assignees[0]);
  request.set("offset", String(offset));
  request.set("limit", "50");

  const query = useQuery({ queryKey: [...qk.tickets(workspace.id), request.toString()], queryFn: () => api.listTickets(workspace.id, request) });
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(workspace.id, true) });
  const members = useQuery({ queryKey: qk.members(workspace.id), queryFn: () => listMembers(workspace.id) });
  const dashboard = useQuery({ queryKey: qk.dashboard(workspace.id), queryFn: () => api.getDashboard(workspace.id) });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Schemas["CommentUpdate"] }) => updateComment(id, patch),
    onSuccess: () => invalidateTicketsAndDashboard(cache, workspace.id),
  });

  function set(key: string, value: string | string[]) {
    const next = new URLSearchParams(params);
    if (Array.isArray(value)) {
      next.delete(key);
      value.forEach((v) => next.append(key, v));
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
      const keys =
        group === "status"
          ? [STATUS_LABELS[ticket.status]]
          : group === "project"
            ? [ticket.project_name]
            : group === "priority"
              ? [ticket.priority ?? "medium"]
              : group === "tag"
                ? ticket.tags?.length
                  ? ticket.tags
                  : ["No tags"]
                : group === "assignee"
                  ? ticket.assignee_ids?.length
                    ? ticket.assignee_ids.map((id) => members.data?.find((m) => m.user_id === id)?.name ?? "Former member")
                    : ["Unassigned"]
                  : [""];
      for (const key of keys) result.set(key, [...(result.get(key) ?? []), ticket]);
    }
    return [...result];
  }, [tickets, group, members.data]);

  async function exportAll() {
    setExporting(true);
    setExportError("");
    try {
      const rows: api.Ticket[] = [];
      for (let start = 0; ; start += 100) {
        const p = new URLSearchParams(request);
        p.set("offset", String(start));
        p.set("limit", "100");
        const page = await api.listTickets(workspace.id, p);
        rows.push(...page.items);
        if (start + page.items.length >= page.total || !page.items.length) break;
      }
      downloadCsv(
        [
          ["Project", "Ticket", "Status", "Priority", "Due", "Tags", "Assignees"],
          ...rows.map((t) => [
            t.project_name,
            t.body,
            STATUS_LABELS[t.status],
            t.priority,
            t.due_at?.slice(0, 10),
            t.tags?.join(", "),
            t.assignee_ids?.map((id) => members.data?.find((m) => m.user_id === id)?.name ?? id).join(", "),
          ]),
        ],
        "backline-tickets.csv",
      );
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not export tickets.");
    } finally {
      setExporting(false);
    }
  }

  const tabCounts: Record<string, number | undefined> = {
    all: dashboard.data?.tickets,
    mine: dashboard.data?.assigned_to_me,
    reply: dashboard.data?.needs_reply,
    client: dashboard.data?.waiting_on_client,
    overdue: dashboard.data?.overdue,
  };

  const activeFilters: { label: string; onClear: () => void }[] = [
    ...(params.get("status") ? [{ label: STATUS_LABELS[params.get("status") as keyof typeof STATUS_LABELS], onClear: () => set("status", "") }] : []),
    ...(params.get("project_id")
      ? [{ label: projects.data?.find((p) => p.id === params.get("project_id"))?.name ?? "Project", onClear: () => set("project_id", "") }]
      : []),
    ...(params.get("priority") ? [{ label: `${params.get("priority")} priority`, onClear: () => set("priority", "") }] : []),
    ...(params.get("tag") ? [{ label: params.get("tag")!, onClear: () => set("tag", "") }] : []),
    ...assignees.map((a) => ({
      label: a === "unassigned" ? "Unassigned" : (members.data?.find((m) => m.user_id === a)?.name ?? a),
      onClear: () => set("assignee", assignees.filter((x) => x !== a)),
    })),
  ];

  const selected = params.get("ticket");

  return (
    <main className="bl-wrap">
      <header className="bl-head">
        <div>
          <p className="bl-eyebrow">Across your projects</p>
          <h1>{params.get("view") === "mine" ? "Assigned to me" : "All tickets"}</h1>
          <p>Every comment, plus the work your team raises directly.</p>
        </div>
        <div className="bl-chip-row">
          <button className="bl-quiet" disabled={exporting} onClick={() => void exportAll()}>
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <button className="bl-button" onClick={() => setShowCreate(true)}>
            <PlusIcon width={13} height={13} /> New ticket
          </button>
        </div>
      </header>

      <div className="bl-tabs">
        {VIEW_TABS.map((tab) => (
          <button key={tab.key} aria-pressed={(params.get("view") ?? "all") === tab.key} onClick={() => set("view", tab.key)}>
            {tab.label}
            {tabCounts[tab.key] !== undefined && <span className="bl-count">{tabCounts[tab.key]}</span>}
          </button>
        ))}
      </div>

      <div className="bl-toolbar wrap">
        <input className="bl-input" aria-label="Search tickets" placeholder="Search tickets or projects…" value={params.get("search") ?? ""} onChange={(e) => set("search", e.target.value)} />
        <select className="bl-select" aria-label="Filter ticket status" value={params.get("status") ?? ""} onChange={(e) => set("status", e.target.value)}>
          <option value="">All statuses</option>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select className="bl-select" aria-label="Filter ticket project" value={params.get("project_id") ?? ""} onChange={(e) => set("project_id", e.target.value)}>
          <option value="">All projects</option>
          {projects.data
            ?.filter((p) => !p.archived_at)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
        <select className="bl-select" aria-label="Filter priority" value={params.get("priority") ?? ""} onChange={(e) => set("priority", e.target.value)}>
          <option value="">All priorities</option>
          {["high", "medium", "low"].map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="bl-select" aria-label="Filter tag" value={params.get("tag") ?? ""} onChange={(e) => set("tag", e.target.value)}>
          <option value="">All tags</option>
          {TAGS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <button
          className="bl-quiet"
          onClick={() => {
            const next = new URLSearchParams();
            next.set("view", params.get("view") || "all");
            next.set("display", params.get("display") || "list");
            setParams(next);
          }}
        >
          Clear filters
        </button>
      </div>

      {activeFilters.length > 0 && (
        <div className="bl-chip-row" style={{ padding: "0 0 14px" }}>
          <span className="bl-eyebrow" style={{ margin: 0 }}>
            Filtering by:
          </span>
          {activeFilters.map((f) => (
            <button key={f.label} className="bl-chip" onClick={f.onClear} aria-label={`Clear filter ${f.label}`}>
              {f.label} ✕
            </button>
          ))}
        </div>
      )}

      <div className="bl-toolbar">
        <span className="bl-mono">{query.data?.total ?? "—"} TICKETS</span>
        <div className="bl-tool-right">
          <TicketToolbar
            sort={sort}
            onSort={(v) => set("sort", v)}
            group={group}
            onGroup={(v) => set("group", v)}
            showGroup={display === "list" || display === "table"}
            members={members.data ?? []}
            assignees={assignees}
            onAssignees={(v) => set("assignee", v)}
          />
          <div className="bl-segment">
            {["list", "board", "table", "calendar"].map((v) => (
              <button key={v} aria-pressed={display === v} onClick={() => set("display", v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {query.isLoading && <p role="status">Loading tickets…</p>}
      {[query.error?.message, update.error?.message, exportError].filter(Boolean).map((error) => (
        <p key={error} className="bl-error" role="alert">
          {error}
        </p>
      ))}

      {display === "board" ? (
        <TicketBoard tickets={tickets} members={members.data ?? []} update={update} onOpen={(id) => set("ticket", id)} />
      ) : display === "calendar" ? (
        <TicketCalendar tickets={tickets} update={update} onOpen={(id) => set("ticket", id)} />
      ) : (
        groups.map(([label, rows]) => (
          <section key={label}>
            {label && (
              <h2 className="bl-group-title">
                {label} <span>{rows.length}</span>
              </h2>
            )}
            {display === "table" ? (
              <TicketTable
                tickets={rows}
                members={members.data ?? []}
                update={update}
                sort={sort}
                onSort={(v) => set("sort", v)}
                onOpen={(id) => set("ticket", id)}
                onFilterProject={(id) => set("project_id", id)}
                onFilterTag={(tag) => set("tag", tag)}
              />
            ) : (
              <div className="bl-table-wrap">
                {rows.map((t) => (
                  <TicketRow key={t.id} ticket={t} members={members.data ?? []} update={update} onOpen={(id) => set("ticket", id)} onFilterTag={(tag) => set("tag", tag)} />
                ))}
              </div>
            )}
          </section>
        ))
      )}

      {query.data?.total === 0 && (
        <div className="bl-empty">
          <h2>Nothing here</h2>
          <p>No tickets match these filters. Clear them, or raise a new team ticket that isn't tied to a comment yet.</p>
          <div className="bl-chip-row" style={{ justifyContent: "center", marginTop: 12 }}>
            <button
              className="bl-quiet"
              onClick={() => {
                const next = new URLSearchParams();
                next.set("view", params.get("view") || "all");
                next.set("display", params.get("display") || "list");
                setParams(next);
              }}
            >
              Show all tickets
            </button>
            <button className="bl-button" onClick={() => setShowCreate(true)}>
              New ticket
            </button>
          </div>
        </div>
      )}

      {query.data && query.data.total > 0 && (
        <div className="bl-pagination">
          <button disabled={offset === 0} onClick={() => set("offset", String(Math.max(0, offset - 50)))}>
            Previous
          </button>
          <span>
            Showing {offset + 1}–{Math.min(offset + 50, query.data.total)} of {query.data.total}
          </span>
          <button disabled={offset + 50 >= query.data.total} onClick={() => set("offset", String(offset + 50))}>
            Next
          </button>
        </div>
      )}

      {showCreate && <NewTicket workspace={workspace} members={members.data ?? []} onClose={() => setShowCreate(false)} />}
      {selected && <TicketDetail id={selected} workspace={workspace} members={members.data ?? []} onClose={() => set("ticket", "")} />}
    </main>
  );
}
