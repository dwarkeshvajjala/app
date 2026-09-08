import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useOutletContext, useSearchParams } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useToast } from "../../components/Toast";
import { PlusIcon, SearchIcon } from "../../components/icons";
import { qk } from "../../lib/query-keys";
import { useDocumentTitle } from "../../lib/use-document-title";
import { listProjects } from "../projects/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as api from "./api";

export function ClientsPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  useDocumentTitle('Clients');
  const cache = useQueryClient();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const [edit, setEdit] = useState<api.Client | "new" | null>(null);
  const [archive, setArchive] = useState<api.Client | null>(null);
  const clients = useQuery({ queryKey: qk.clients(workspace.id), queryFn: () => api.listClients(workspace.id) });
  const projects = useQuery({ queryKey: qk.projects(workspace.id), queryFn: () => listProjects(workspace.id, true) });
  const remove = useMutation({ mutationFn: (id: string) => api.archiveClient(workspace.id, id), onSuccess: async () => { await cache.invalidateQueries({ queryKey: qk.clients(workspace.id) }); setArchive(null); } });
  const visible = (clients.data ?? []).filter((c) => `${c.name} ${c.contact_name} ${c.email ?? ""}`.toLowerCase().includes(search.toLowerCase()));

  return <main className="bl-wrap">
    <header className="bl-head">
      <div>
        <p className="bl-eyebrow">Workspace</p>
        <h1>Clients</h1>
        <p>Your client relationships and the projects you're reviewing together.</p>
      </div>
      <div className="bl-head-actions">
        <button type="button" className="bl-button mint" onClick={() => setEdit("new")}><PlusIcon width="14" height="14" /> Add client</button>
      </div>
    </header>

    <div className="bl-toolbar wrap">
      <span className="bl-mono">{visible.length} CLIENT{visible.length === 1 ? "" : "S"}</span>
      <label className="bl-search">
        <span className="bl-search-icon" aria-hidden="true"><SearchIcon /></span>
        <input
          aria-label="Search clients"
          placeholder="Search clients, contacts or email…"
          value={search}
          onChange={(e) => setParams(e.target.value ? { search: e.target.value } : {})}
          onKeyDown={(e) => { if (e.key === "Escape" && search) { e.stopPropagation(); setParams({}); } }}
        />
      </label>
    </div>

    {clients.isLoading && <LoadingScreen />}
    {clients.error && <p role="alert" className="bl-error">{clients.error.message}</p>}
    {projects.error && <p role="alert" className="bl-error">Project associations could not load: {projects.error.message}</p>}

    {!clients.isLoading && !clients.error && (
      visible.length > 0 ? (
        <div className="bl-table-wrap">
          <table className="bl-table">
            <thead><tr><th>Client &amp; contact</th><th>Active</th><th>Projects</th><th>Added</th><th /></tr></thead>
            <tbody>
              {visible.map((client) => {
                const clientProjects = (projects.data ?? []).filter((p) => p.client_id === client.id && !p.archived_at);
                return (
                  <tr key={client.id}>
                    <td>
                      <button type="button" className="bl-text-button" onClick={() => setEdit(client)}>
                        <span className="bl-avatar">{client.name.slice(0, 2).toUpperCase()}</span>
                        <span>
                          <strong>{client.name}</strong>
                          <small>{client.contact_name || "No contact"}{client.email ? ` · ${client.email}` : ""}</small>
                        </span>
                      </button>
                    </td>
                    <td className="bl-mono">{clientProjects.length}</td>
                    <td>
                      <div className="bl-chip-row">
                        {clientProjects.length === 0 && <span className="bl-chip">No projects yet</span>}
                        {clientProjects.slice(0, 3).map((p) => <Link className="bl-chip" key={p.id} to={`/w/${workspace.slug}/p/${p.id}`}>{p.name}</Link>)}
                        {clientProjects.length > 3 && <span className="bl-chip">+{clientProjects.length - 3} more</span>}
                      </div>
                    </td>
                    <td>{new Date(client.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td>
                    <td>
                      <select
                        className="bl-select"
                        aria-label={`Actions for ${client.name}`}
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'edit') setEdit(client);
                          else if (v === 'archive') setArchive(client);
                          else if (v === 'export') toast('Client export is not available yet.', 'warning');
                          else if (v === 'new') toast('Start a new project from Projects → New project — this workflow entry point is not wired up yet.', 'warning');
                        }}
                      >
                        <option value="" disabled>Options…</option>
                        <option value="edit">Rename / edit</option>
                        <option value="new">New project</option>
                        <option value="export">Export</option>
                        <option value="archive">Archive</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bl-empty">
          <h2>{search ? "No clients match" : "Your next client starts here"}</h2>
          <p>{search ? "Try another name or email." : "Add a client, then connect their review projects."}</p>
        </div>
      )
    )}

    {edit && <ClientForm key={edit === "new" ? "new" : edit.id} workspaceId={workspace.id} client={edit === "new" ? undefined : edit} onClose={() => setEdit(null)} />}

    {archive &&
      <Dialog title={`Archive ${archive.name}?`} onClose={() => setArchive(null)}>
        <div className="bl-dialog-intro">
          <p>The contact leaves the active client list. Existing projects and review links remain available, and the client can be restored later.</p>
        </div>
        {remove.error && <p role="alert" className="bl-error">{remove.error.message}</p>}
        <footer className="bl-dialog-actions bl-dialog-actions-bordered">
          <button type="button" className="bl-quiet" onClick={() => setArchive(null)}>Cancel</button>
          <button type="button" className="bl-button danger" disabled={remove.isPending} onClick={() => remove.mutate(archive.id)}>
            {remove.isPending ? "Archiving…" : "Archive client"}
          </button>
        </footer>
      </Dialog>
    }
  </main>;
}

function ClientForm({ workspaceId, client, onClose }: { workspaceId: string; client?: api.Client; onClose: () => void }) {
  const cache = useQueryClient();
  const [name, setName] = useState(client?.name ?? "");
  const [contact, setContact] = useState(client?.contact_name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");

  const save = useMutation({
    mutationFn: () => client ?
      api.updateClient(workspaceId, client.id, { name: name.trim(), contact_name: contact.trim(), email: email.trim() || null }) :
      api.createClient(workspaceId, { name: name.trim(), contact_name: contact.trim(), email: email.trim() || null }),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: qk.clients(workspaceId) });
      onClose();
    }
  });

  return <Dialog title={client ? "Edit client" : "Add a client"} onClose={onClose}>
    <form className="bl-compact-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <label>
        <span>Client name <span className="bl-required">Required</span></span>
        <input className="bl-input" autoFocus required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g. Acme Corp" />
      </label>
      <label>Main contact
        <input className="bl-input" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name of the person you work with" />
      </label>
      <label>Email
        <input className="bl-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contact@client.com" />
        <small>Kept private to team members only.</small>
      </label>
      {save.error && <p role="alert" className="bl-error">{save.error.message}</p>}
      <footer className="bl-dialog-actions">
        <button type="button" className="bl-quiet" onClick={onClose}>Cancel</button>
        <button className="bl-button mint" disabled={save.isPending || !name.trim()}>
          {save.isPending ? "Saving…" : "Save client"}
        </button>
      </footer>
    </form>
  </Dialog>;
}
