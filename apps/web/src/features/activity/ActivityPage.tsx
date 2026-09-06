import { useQuery } from "@tanstack/react-query";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { qk } from "../../lib/query-keys";
import { listMembers } from "../workspaces/api";
import type { WorkspaceOut } from "../workspaces/api";
import { listActivity } from "./api";

export function ActivityPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const [params, setParams] = useSearchParams();
  const offset = Math.max(0, Number(params.get("offset")) || 0), filter = params.get("type") ?? "";
  const query = useQuery({ queryKey: [...qk.activity(workspace.id), offset, filter], queryFn: () => listActivity(workspace.id, offset, filter) });
  const members = useQuery({ queryKey: qk.members(workspace.id), queryFn: () => listMembers(workspace.id) });
  function page(value: number) { setParams({ type: filter, offset: String(value) }); }
  return <main className="bl-wrap"><header className="bl-head"><div><p className="bl-eyebrow">Workspace</p><h1>Activity</h1><p>What changed across your workspace.</p></div></header><div className="bl-toolbar"><label>Show <select className="bl-input" aria-label="Filter activity" value={filter} onChange={(e) => setParams({ type: e.target.value })}><option value="">Everything</option>{['comment.', 'project.', 'client.', 'share_link.', 'member.'].map((t) => <option key={t} value={t}>{t.replace('.', '')}</option>)}</select></label></div>
    {query.isLoading && <p role="status">Loading activity…</p>}{query.error && <p role="alert" className="bl-error">{query.error.message}</p>}
    <div className="bl-activity">{query.data?.items.map((event) => <article key={event.id}><span className="bl-avatar">{event.actor_type === "system" ? "BL" : "↗"}</span><div><p><strong>{members.data?.find((m) => m.user_id === event.actor_id)?.name ?? (event.actor_type === "system" ? "Backline" : event.actor_type === "guest" ? "Reviewer" : "Team member")}</strong> · {event.type.replace(/\./g, ' ').replace(/_/g, ' ')}</p>{event.name && <p>{event.name}</p>}{event.project_id && <Link className="bl-chip" to={`/w/${workspace.slug}/p/${event.project_id}/board${event.comment_id ? `?comment=${event.comment_id}` : ''}`}>Open project →</Link>}</div><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString()}</time></article>)}</div>
    {query.data?.total === 0 && <div className="bl-empty"><h2>No activity yet</h2><p>Changes will appear here as your team works.</p></div>}
    {query.data && query.data.total > 50 && <div className="bl-pagination"><button disabled={offset === 0} onClick={() => page(Math.max(0, offset - 50))}>Previous</button><span>{offset + 1}–{Math.min(offset + 50, query.data.total)} of {query.data.total}</span><button disabled={offset + 50 >= query.data.total} onClick={() => page(offset + 50)}>Next</button></div>}
  </main>;
}
