import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Dialog } from "../../components/Dialog";
import { qk } from "../../lib/query-keys";
import { uploadAsset } from "../assets/api";
import { createClient, listClients } from "../clients/api";
import { listShareLinks } from "../share-links/api";
import type { WorkspaceOut } from "../workspaces/api";
import * as api from "./api";

export function ProjectForm({ workspace, project, onClose }: { workspace: WorkspaceOut; project?: api.ProjectOut; onClose: () => void }) {
  const cache = useQueryClient();
  const clients = useQuery({ queryKey: qk.clients(workspace.id), queryFn: () => listClients(workspace.id) });
  const [type, setType] = useState<"website" | "image" | "pdf">(project?.project_type ?? "website");
  const [name, setName] = useState(project?.name ?? ""), [url, setUrl] = useState(project?.target_origin ?? ""), [client, setClient] = useState(project?.client_id ?? "");
  const [environment, setEnvironment] = useState<"live" | "staging">(project?.environment ?? "live");
  const [environmentEdited, setEnvironmentEdited] = useState(Boolean(project));
  
  // Review settings
  const settings = project?.settings as any;
  const [captureDeviceDetails, setCaptureDeviceDetails] = useState(settings?.capture_device_details ?? false);
  const [reanchorOnDeploy, setReanchorOnDeploy] = useState(settings?.reanchor_on_deploy ?? false);
  const [reviewerCanResolve, setReviewerCanResolve] = useState(settings?.reviewer_can_resolve ?? false);
  const [showBoardToClient, setShowBoardToClient] = useState(settings?.show_board_to_client ?? false);
  const [clientDigestEnabled, setClientDigestEnabled] = useState(settings?.client_digest_enabled ?? false);
  const [newClientName, setNewClientName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [created, setCreated] = useState<api.ProjectOut | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [done, setDone] = useState(false);
  const save = useMutation({ mutationFn: async () => {
    let clientId = client;
    if (client === "new") { const c = await createClient(workspace.id, { name: newClientName, contact_name: "" }); clientId = c.id; setClient(c.id); await cache.invalidateQueries({ queryKey: qk.clients(workspace.id) }); }
    if (project) {
      await api.updateProjectSettings(project.id, {
        capture_device_details: captureDeviceDetails,
        reanchor_on_deploy: reanchorOnDeploy,
        reviewer_can_resolve: reviewerCanResolve,
        show_board_to_client: showBoardToClient,
        client_digest_enabled: clientDigestEnabled,
      });
      return api.updateProject(project.id, { name: name.trim(), ...(type === 'website' ? { target_origin: url.trim(), environment } : {}), client_id: clientId || null });
    }
    const current = created ?? await api.createProject(workspace.id, name.trim(), type === 'website' ? url.trim() : '', { project_type: type, environment, client_id: clientId || null });
    setCreated(current);
    for (const file of files) { const key = `${file.name}:${file.size}:${file.lastModified}`; if (!uploaded.includes(key)) { await uploadAsset(current.id, file); setUploaded((old) => [...old, key]); } }
    const links = await listShareLinks(current.id);
    const active = links.find((l) => !l.revoked_at);
    if (active) setLink(`${window.location.origin}/review/${active.token}`);
    return current;
  }, onSuccess: async () => { await cache.invalidateQueries({ queryKey: qk.workspace(workspace.id) }); if (project) { await cache.invalidateQueries({ queryKey: ['project', project.id] }); onClose(); } else setDone(true); } });
  if (done && created) return <Dialog title="Project created" onClose={onClose}><div className="bl-form"><p>{created.name} is ready. Reviewers can open this link without creating an account.</p><label>Review link<input className="bl-input" readOnly value={link} onFocus={(e) => e.target.select()} /></label><button className="bl-quiet" onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setCopyError('Select the link and copy it manually.')); }}>{copied ? 'Copied' : 'Copy link'}</button>{copyError && <p role="alert">{copyError}</p>}<Link className="bl-button" to={`/w/${workspace.slug}/p/${created.id}`}>Open project →</Link></div></Dialog>;
  return <Dialog title={project ? "Project settings" : "Create a project"} onClose={onClose}><form className="bl-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
    {!project && <fieldset disabled={Boolean(created)}><legend>What are you reviewing?</legend><div className="bl-segment">{[['website','Website'],['image','Images'],['pdf','PDF']].map(([key,label]) => <button type="button" key={key} aria-pressed={type === key} onClick={() => { setType(key as typeof type); setFiles([]); }}>{label}</button>)}</div></fieldset>}
    <p>{type === 'website' ? 'Review a public or staging website.' : type === 'pdf' ? 'Upload one PDF with up to 200 pages, maximum 20 MB.' : 'Upload up to 50 PNG, JPG, WebP or GIF images, maximum 20 MB each.'} Your project gets a shareable review link.</p>
    <fieldset className="bl-form bl-flush" disabled={Boolean(created)}><label>Client<select className="bl-input" value={client} onChange={(e) => setClient(e.target.value)}><option value="">No client — internal work</option>{clients.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="new">＋ Add a new client</option></select></label>{client === "new" && <label>Client name<input className="bl-input" required value={newClientName} onChange={(e) => setNewClientName(e.target.value)} /></label>}<label>Project name<input className="bl-input" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'website' ? 'Website redesign' : 'Launch creative'} /></label>{type === 'website' && <><label>Review URL<input className="bl-input" required value={url} onChange={(e) => { setUrl(e.target.value); if (!environmentEdited) setEnvironment(/staging|stage\.|dev\.|preview|localhost|vercel\.app|netlify\.app|webflow\.io/i.test(e.target.value) ? "staging" : "live"); }} placeholder="staging.yoursite.com" /></label><label>Environment<select className="bl-input" value={environment} onChange={(e) => { setEnvironment(e.target.value as "live" | "staging"); setEnvironmentEdited(true); }}><option value="live">Live</option><option value="staging">Staging</option></select></label></>}</fieldset>
    {!project && type !== 'website' && <label>Files<input type="file" className="bl-input" required={files.length === 0} multiple={type === 'image'} accept={type === 'pdf' ? 'application/pdf' : 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'} onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /><span className="bl-mono">{files.length} selected · {uploaded.length} uploaded</span></label>}
    {project && (
      <fieldset className="bl-form bl-flush">
        <legend>Review settings</legend>
        <label className="bl-checkbox"><input type="checkbox" checked={captureDeviceDetails} onChange={(e) => setCaptureDeviceDetails(e.target.checked)} /> Capture browser/device details</label>
        <label className="bl-checkbox"><input type="checkbox" checked={reanchorOnDeploy} onChange={(e) => setReanchorOnDeploy(e.target.checked)} /> Re-anchor comments after deployment</label>
        <label className="bl-checkbox"><input type="checkbox" checked={reviewerCanResolve} onChange={(e) => setReviewerCanResolve(e.target.checked)} /> Let reviewers resolve their own comments</label>
        <label className="bl-checkbox"><input type="checkbox" checked={showBoardToClient} onChange={(e) => setShowBoardToClient(e.target.checked)} /> Show the ticket board to the client</label>
        <label className="bl-checkbox"><input type="checkbox" checked={clientDigestEnabled} onChange={(e) => setClientDigestEnabled(e.target.checked)} /> Email digest to the client</label>
      </fieldset>
    )}
    {save.error && <p role="alert" className="bl-error">{save.error.message}{created && ' The project was saved. Retry to finish the remaining uploads, or open it from Projects.'}</p>}<footer className="bl-form-actions"><button type="button" className="bl-quiet" onClick={onClose}>Cancel</button><button className="bl-button" disabled={save.isPending || !name.trim() || (type === 'website' ? !url.trim() : !project && files.length === 0)}>{save.isPending ? "Saving…" : project ? "Save changes" : created ? "Finish project" : "Create project"}</button></footer>
  </form></Dialog>;
}
