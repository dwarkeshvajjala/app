import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog } from "../../../components/Dialog";
import { invalidateTicketsAndDashboard, qk } from "../../../lib/query-keys";
import { listProjects } from "../../projects/api";
import type { WorkspaceOut, MemberOut } from "../../workspaces/api";
import * as api from "../api";
import { PeoplePicker } from "./PeoplePicker";

export function NewTicket({ workspace, members, onClose }: { workspace: WorkspaceOut; members: MemberOut[]; onClose: () => void }) {
  const cache = useQueryClient();
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(workspace.id, true) });
  const [projectId, setProjectId] = useState("");
  const [body, setBody] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const save = useMutation({ mutationFn: () => api.createTicket(projectId, { body, status: "todo", priority, assignee_ids: assignees }), onSuccess: async () => { await invalidateTicketsAndDashboard(cache, workspace.id); await cache.invalidateQueries({ queryKey: qk.projectComments(projectId) }); onClose(); } });
  return <Dialog title="New team ticket" onClose={onClose}><form className="bl-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><p>Raise work for your team without pinning it to a page.</p><label>Project<select className="bl-input" required value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Choose a project</option>{projects.data?.filter((p) => !p.archived_at).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>What needs to change?<textarea className="bl-input" required rows={4} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} /></label><label>Priority<select className="bl-input" value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>{['high','medium','low'].map((p) => <option key={p}>{p}</option>)}</select></label><PeoplePicker label="Assignees" members={members} selected={assignees} onChange={setAssignees} />{save.error && <p role="alert" className="bl-error">{save.error.message}</p>}<button className="bl-button" disabled={save.isPending || !projectId || !body.trim()}>{save.isPending ? "Creating…" : "Create ticket"}</button></form></Dialog>;
}
