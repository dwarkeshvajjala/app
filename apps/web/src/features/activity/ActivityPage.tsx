import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { qk } from "../../lib/query-keys";
import { useDocumentTitle } from "../../lib/use-document-title";
import { listMembers } from "../workspaces/api";
import type { WorkspaceOut } from "../workspaces/api";
import { listActivity } from "./api";

function getEventIcon(type: string) {
  if (type.startsWith("comment.")) return "💬";
  if (type.startsWith("project.")) return "📁";
  if (type.startsWith("client.")) return "🏢";
  if (type.startsWith("share_link.")) return "🔗";
  if (type.startsWith("member.")) return "👤";
  return "⚡";
}

export function ActivityPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  useDocumentTitle('Activity');
  const [params, setParams] = useSearchParams();
  const offset = Math.max(0, Number(params.get("offset")) || 0), filter = params.get("type") ?? "";
  const query = useQuery({ queryKey: [...qk.activity(workspace.id), offset, filter], queryFn: () => listActivity(workspace.id, offset, filter) });
  const members = useQuery({ queryKey: qk.members(workspace.id), queryFn: () => listMembers(workspace.id) });
  function page(value: number) { setParams({ type: filter, offset: String(value) }); }
  
  const groups = useMemo(() => {
    const result = new Map<string, NonNullable<typeof query.data>["items"]>();
    for (const event of query.data?.items ?? []) {
      const date = new Date(event.created_at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
      result.set(date, [...(result.get(date) ?? []), event]);
    }
    return [...result.entries()];
  }, [query.data?.items]);

  return <main className="bl-wrap">
    <header className="bl-head"><div><p className="bl-eyebrow">Workspace</p><h1>Activity</h1><p>What changed across your workspace.</p></div></header>
    <div className="bl-tabs">
      <button aria-pressed={filter === ""} onClick={() => setParams({ type: "", offset: "0" })}>Everything</button>
      {['comment.', 'project.', 'client.', 'share_link.', 'member.'].map((t) => 
        <button key={t} aria-pressed={filter === t} onClick={() => setParams({ type: t, offset: "0" })}>{t.replace('.', '').charAt(0).toUpperCase() + t.replace('.', '').slice(1)}</button>
      )}
    </div>
    {query.isLoading && <p role="status">Loading activity…</p>}{query.error && <p role="alert" className="bl-error">{query.error.message}</p>}
    <div className="bl-activity">
      {groups.map(([date, events]) => (
        <section key={date} style={{ marginBottom: '2rem' }}>
          <h2 className="bl-group-title" style={{ position: 'sticky', top: 0, background: 'var(--bg-base)', padding: '0.5rem 0', zIndex: 1 }}>{date}</h2>
          {events.map((event) => (
            <article key={event.id} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="bl-avatar" style={{ fontSize: '1.2rem', background: 'var(--bg-elevated)' }}>
                {getEventIcon(event.type)}
              </span>
              <div style={{ flex: 1 }}>
                <p>
                  <strong>{members.data?.find((m) => m.user_id === event.actor_id)?.name ?? (event.actor_type === "system" ? "Backline" : event.actor_type === "guest" ? "Reviewer" : "Team member")}</strong> 
                  <span style={{ color: 'var(--text-subtle)' }}> · {event.type.replace(/\./g, ' ').replace(/_/g, ' ')}</span>
                </p>
                {event.name && <p style={{ marginTop: '0.25rem' }}>{event.name}</p>}
                {event.project_id && <Link className="bl-chip" style={{ marginTop: '0.5rem', display: 'inline-block' }} to={`/w/${workspace.slug}/p/${event.project_id}/board${event.comment_id ? `?comment=${event.comment_id}` : ''}`}>Open project →</Link>}
              </div>
              <time dateTime={event.created_at} style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {new Date(event.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </time>
            </article>
          ))}
        </section>
      ))}
    </div>
    {query.data?.total === 0 && <div className="bl-empty"><h2>No activity yet</h2><p>Changes will appear here as your team works.</p></div>}
    {query.data && query.data.total > 50 && <div className="bl-pagination"><button disabled={offset === 0} onClick={() => page(Math.max(0, offset - 50))}>Previous</button><span>{offset + 1}–{Math.min(offset + 50, query.data.total)} of {query.data.total}</span><button disabled={offset + 50 >= query.data.total} onClick={() => page(offset + 50)}>Next</button></div>}
  </main>;
}
