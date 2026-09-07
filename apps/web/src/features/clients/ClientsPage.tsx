import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { qk } from "../../lib/query-keys";
import { useDocumentTitle } from "../../lib/use-document-title";
import { listProjects } from "../projects/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as api from "./api";

export function ClientsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  useDocumentTitle('Clients');
  const cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const [edit, setEdit] = useState<api.Client | "new" | null>(null);
  const [archive, setArchive] = useState<api.Client | null>(null);
  const clients = useQuery({ queryKey: qk.clients(workspace.id), queryFn: () => api.listClients(workspace.id) });
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(workspace.id, true) });
  const remove = useMutation({ mutationFn: (id: string) => api.archiveClient(workspace.id, id), onSuccess: async () => { await cache.invalidateQueries({ queryKey: qk.clients(workspace.id) }); setArchive(null); } });
  const visible = (clients.data ?? []).filter((c) => `${c.name} ${c.contact_name} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="bl-wrap"><header className="bl-head"><div><p className="bl-eyebrow">Workspace</p><h1>Clients</h1><p>Your client relationships and the projects you're reviewing together.</p></div><button className="bl-button" onClick={() => setEdit("new")}>＋ Add client</button></header>
    <div className="bl-toolbar"><input className="bl-input" aria-label="Search clients" placeholder="Search clients, contacts or email…" value={search} onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {})} /><span className="bl-mono">{visible.length} clients</span></div>
    {clients.isLoading && <p role="status">Loading clients…</p>}{clients.error && <p role="alert" className="bl-error">{clients.error.message}</p>}{projects.error && <p role="alert" className="bl-error">Project associations could not load: {projects.error.message}</p>}
    {!clients.isLoading && !clients.error && <div className="bl-table-wrap"><table className="bl-table"><thead><tr><th>Client</th><th>Main contact</th><th>Active Projects</th><th>Projects</th><th>Since</th><th>Actions</th></tr></thead><tbody>{visible.map((client) => {
      const clientProjects = (projects.data ?? []).filter((p) => p.client_id === client.id && !p.archived_at);
      return <tr key={client.id}><td><button className="bl-text-button" onClick={() => setEdit(client)}><span className="bl-avatar">{client.name.slice(0, 2).toUpperCase()}</span><strong>{client.name}</strong></button></td><td>{client.contact_name || "No contact"}<small>{client.email || "No email"}</small></td><td><span className="bl-mono">{clientProjects.length}</span></td><td><div className="bl-chip-row">{clientProjects.map((p) => <Link className="bl-chip" key={p.id} to={`/w/${workspace.slug}/p/${p.id}`}>{p.name}</Link>)}</div></td><td>{new Date(client.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td><td>
        <select 
          className="bl-select" 
          aria-label={`Actions for ${client.name}`} 
          value="" 
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'edit') setEdit(client);
            else if (v === 'archive') setArchive(client);
            else if (v === 'export') alert('Client export functionality coming soon.');
            else if (v === 'new') alert('New project wizard coming soon.');
          }}
        >
          <option value="" disabled>Options…</option>
          <option value="edit">Rename / Edit</option>
          <option value="new">New project</option>
          <option value="export">Export</option>
          <option value="archive">Archive</option>
        </select>
      </td></tr>;
    })}</tbody></table>{visible.length === 0 && <div className="bl-empty"><h2>{search ? "No clients match" : "Your next client starts here"}</h2><p>{search ? "Try another name or email." : "Add a client, then connect their review projects."}</p></div>}</div>}
    {edit && <ClientForm key={edit === "new" ? "new" : edit.id} workspaceId={workspace.id} client={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}
    {archive && <Dialog title={`Archive ${archive.name}?`} onClose={() => setArchive(null)}><div className="bl-form"><p>The contact leaves the active client list. Existing projects and review links remain available.</p>{remove.error && <p role="alert" className="bl-error">{remove.error.message}</p>}<button className="bl-button" disabled={remove.isPending} onClick={() => remove.mutate(archive.id)}>Archive client</button></div></Dialog>}
  </main>;
}

function ClientForm({ workspaceId, client, onClose }: { workspaceId: string; client?: api.Client; onClose: () => void }) {
  const cache = useQueryClient();
  const [name, setName] = useState(client?.name ?? "");
  const [contact, setContact] = useState(client?.contact_name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const save = useMutation({ mutationFn: () => client ? api.updateClient(workspaceId, client.id, { name: name.trim(), contact_name: contact.trim(), email: email.trim() || null }) : api.createClient(workspaceId, { name: name.trim(), contact_name: contact.trim(), email: email.trim() || null }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: qk.clients(workspaceId) }); onClose(); } });
  return <Dialog title={client ? "Edit client" : "Add a client"} onClose={onClose}><form className="bl-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}><label>Client name<input className="bl-input" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} /></label><label>Main contact<input className="bl-input" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} /></label><label>Email<input className="bl-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>{save.error && <p role="alert" className="bl-error">{save.error.message}</p>}<footer className="bl-form-actions"><button type="button" className="bl-quiet" onClick={onClose}>Cancel</button><button className="bl-button" disabled={save.isPending || !name.trim()}>{save.isPending ? "Saving…" : "Save client"}</button></footer></form></Dialog>;
}
