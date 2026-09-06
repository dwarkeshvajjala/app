import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Link } from "react-router-dom";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { qk } from "../../lib/query-keys";
import { STATUS_COLORS, STATUS_LABELS, TAGS } from "../../lib/workflow";
import * as api from "./api";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export function AssetReview({ projectId, title, guest, workspaceSlug }: { projectId: string; title: string; guest?: string; workspaceSlug?: string }) {
  const cache = useQueryClient();
  const [assetId, setAssetId] = useState("");
  const [page, setPage] = useState(1);
  const [commentMode, setCommentMode] = useState(true);
  const [draft, setDraft] = useState<api.Region | null>(null);
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState("");
  const [reply, setReply] = useState("");
  const [tag, setTag] = useState<(typeof TAGS)[number]>("Design");
  const [layer, setLayer] = useState<"client" | "team">("client");
  const start = useRef<{ x: number; y: number } | null>(null);
  const assets = useQuery({ queryKey: ['assets', projectId, guest ?? 'member'], queryFn: () => api.listAssets(projectId, guest), refetchInterval: 30000 });
  const asset = assets.data?.find((a) => a.id === assetId) ?? assets.data?.[0];
  const commentKey = ['asset-comments', asset?.page_id, guest ?? 'member'];
  const comments = useQuery({ queryKey: commentKey, queryFn: () => api.listAssetComments(asset!.page_id, guest), enabled: Boolean(asset), refetchInterval: 10000 });
  const roots = (comments.data ?? []).filter((c) => !c.parent_id && (c.anchor as { region?: api.Region }).region?.page_number === page);
  const selectedComment = roots.find((c) => c.id === selected);
  async function refresh() { await cache.invalidateQueries({ queryKey: ['asset-comments', asset?.page_id] }); if (!guest) { await cache.invalidateQueries({ queryKey: qk.projectComments(projectId) }); await cache.invalidateQueries({ queryKey: ['workspace'] }); } }
  const post = useMutation({ mutationFn: () => api.createAssetComment(projectId, asset!.id, { body: body.trim(), region: draft!, tags: [tag], layer }, guest), onSuccess: async (comment) => { setBody(""); setDraft(null); setSelected(comment.id); await refresh(); } });
  const replyMutation = useMutation({ mutationFn: () => api.replyToComment(selected, reply.trim(), selectedComment?.layer ?? 'client', guest), onSuccess: async () => { setReply(""); await refresh(); } });
  const upload = useMutation({ mutationFn: async (files: FileList) => { for (const file of Array.from(files)) await api.uploadAsset(projectId, file); }, onSettled: () => cache.invalidateQueries({ queryKey: ['assets', projectId] }) });
  function point(e: PointerEvent<HTMLDivElement>) { const rect = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)) }; }
  function down(e: PointerEvent<HTMLDivElement>) { if (!commentMode || !asset || (e.target as HTMLElement).closest('button')) return; e.preventDefault(); start.current = point(e); e.currentTarget.setPointerCapture(e.pointerId); setDraft({ ...start.current, width: 0, height: 0, page_number: page }); setSelected(""); }
  function move(e: PointerEvent<HTMLDivElement>) { if (!start.current) return; const p = point(e), s = start.current; setDraft({ x: Math.min(s.x,p.x), y: Math.min(s.y,p.y), width: Math.abs(p.x-s.x), height: Math.abs(p.y-s.y), page_number: page }); }
  return <main className="bl-review"><header className="bl-review-head">{workspaceSlug && <Link className="bl-quiet" to={`/w/${workspaceSlug}`}>← Projects</Link>}<h1>{title}</h1>{workspaceSlug && <Link className="bl-quiet" to={`/w/${workspaceSlug}/p/${projectId}/share-links`}>Share</Link>}<span className="bl-chip">{guest ? 'Guest review' : 'Team workspace'}</span></header>
    <div className="bl-review-tools"><select className="bl-select" aria-label="Review file" value={asset?.id ?? ''} onChange={(e) => { setAssetId(e.target.value); setPage(1); setDraft(null); setSelected(''); }}>{assets.data?.map((a) => <option key={a.id} value={a.id}>{a.filename}</option>)}</select>{asset && asset.page_count > 1 && <><button className="bl-quiet" disabled={page === 1} onClick={() => { setPage(page - 1); setDraft(null); setSelected(''); }}>Previous page</button><span className="bl-mono">{page} / {asset.page_count}</span><button className="bl-quiet" disabled={page === asset.page_count} onClick={() => { setPage(page + 1); setDraft(null); setSelected(''); }}>Next page</button></>}<div className="bl-segment"><button aria-pressed={!commentMode} onClick={() => { setCommentMode(false); setDraft(null); }}>View</button><button aria-pressed={commentMode} onClick={() => setCommentMode(true)}>Comment</button></div>{!guest && <label className="bl-quiet">{upload.isPending ? "Uploading…" : "Add files"}<input type="file" aria-label="Add project files" disabled={upload.isPending} multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" onChange={(e) => { if (e.target.files) upload.mutate(e.target.files); }} /></label>}</div>
    {[assets.error?.message, comments.error?.message, upload.error?.message].filter(Boolean).map((error) => <p key={error} className="bl-error" role="alert">{error}</p>)}
    <div className="bl-review-body"><section className="bl-asset-stage">{asset ? <><p className="bl-mono">{commentMode ? 'Click to pin a comment, or drag to select a region.' : 'Viewing document'}</p><div className={`bl-asset-sheet ${commentMode ? 'commenting' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={() => { start.current = null; }} onPointerCancel={() => { start.current = null; setDraft(null); }}>
      {asset.content_type === 'application/pdf' ? <PdfCanvas url={asset.url} pageNumber={page} /> : <img draggable={false} src={asset.url} alt={asset.filename} />}
      {roots.map((comment, i) => { const region = (comment.anchor as unknown as { region: api.Region }).region; return <button key={comment.id} className={`bl-asset-pin ${selected === comment.id ? 'selected' : ''}`} style={{ left: `${region.x*100}%`, top: `${region.y*100}%`, width: region.width ? `${region.width*100}%` : undefined, height: region.height ? `${region.height*100}%` : undefined, borderColor: STATUS_COLORS[comment.status] }} aria-label={`Comment ${i+1}: ${comment.body}`} onClick={() => { setSelected(comment.id); setDraft(null); }}><span style={{ background: STATUS_COLORS[comment.status] }}>{i+1}</span></button>; })}
      {draft && <div className="bl-draft-region" style={{ left: `${draft.x*100}%`, top: `${draft.y*100}%`, width: draft.width ? `${draft.width*100}%` : 20, height: draft.height ? `${draft.height*100}%` : 20 }} />}
    </div><button className="bl-quiet" onClick={() => { setDraft({ x: .5, y: .5, width: 0, height: 0, page_number: page }); setSelected(''); }}>Add a comment at the center</button></> : <div className="bl-empty"><h2>{assets.isLoading ? 'Loading files…' : 'No files yet'}</h2><p>{guest ? 'The team has not uploaded a file yet.' : 'Add images or a PDF to begin the review.'}</p></div>}</section>
    <aside className="bl-review-comments"><header><h2>Comments <span className="bl-count">{roots.length}</span></h2></header>{draft && <form className="bl-form" onSubmit={(e) => { e.preventDefault(); post.mutate(); }}><label>New comment<textarea className="bl-input" autoFocus required rows={4} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What needs to change here?" /></label><select className="bl-select" aria-label="Comment tag" value={tag} onChange={(e) => setTag(e.target.value as typeof tag)}>{TAGS.map((t) => <option key={t}>{t}</option>)}</select>{!guest && <select className="bl-select" aria-label="Comment visibility" value={layer} onChange={(e) => setLayer(e.target.value as typeof layer)}><option value="client">Client visible</option><option value="team">Team only</option></select>}{post.error && <p className="bl-error" role="alert">{post.error.message}</p>}<div className="bl-form-actions"><button className="bl-quiet" type="button" onClick={() => setDraft(null)}>Cancel</button><button className="bl-button" disabled={post.isPending || !body.trim()}>Post comment</button></div></form>}
    {selectedComment ? <div className="bl-form"><button className="bl-quiet" onClick={() => setSelected('')}>← All comments</button><p className="bl-mono">{selectedComment.author_name} · {STATUS_LABELS[selectedComment.status]}</p><p>{selectedComment.body}</p>{workspaceSlug && <Link className="bl-chip" to={`/w/${workspaceSlug}/tickets?ticket=${selectedComment.id}`}>Edit status, assignees and due date →</Link>}{comments.data?.filter((c) => c.parent_id === selected).map((c) => <article className="bl-message" key={c.id}><small>{c.author_name} · {c.layer === 'team' ? 'Team only' : 'Client visible'}</small><p>{c.body}</p></article>)}<form className="bl-form bl-flush" onSubmit={(e) => { e.preventDefault(); replyMutation.mutate(); }}><label>Reply<textarea className="bl-input" required value={reply} onChange={(e) => setReply(e.target.value)} /></label>{replyMutation.error && <p className="bl-error" role="alert">{replyMutation.error.message}</p>}<button className="bl-button" disabled={replyMutation.isPending || !reply.trim()}>Post reply</button></form></div> : roots.map((c, i) => <button className="bl-review-comment" key={c.id} onClick={() => { setSelected(c.id); setDraft(null); }}><small>#{i+1} · {c.author_name} · {STATUS_LABELS[c.status]}</small><p>{c.body}</p><span className="bl-chip">{c.layer === 'team' ? 'Team only' : 'Client visible'}</span></button>)}
    </aside></div>
  </main>;
}

function PdfCanvas({ url, pageNumber }: { url: string; pageNumber: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let render: pdfjs.RenderTask | undefined;
    const task = pdfjs.getDocument({ url });
    setError('');
    void task.promise.then(async (document) => {
      const page = await document.getPage(pageNumber);
      if (cancelled || !canvas.current) return;
      const viewport = page.getViewport({ scale: 1.5 });
      canvas.current.width = viewport.width; canvas.current.height = viewport.height;
      const context = canvas.current.getContext('2d');
      if (!context) throw new Error('Canvas is unavailable.');
      render = page.render({ canvas: canvas.current, canvasContext: context, viewport });
      await render.promise;
    }).catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'PDF could not be rendered.'); });
    return () => { cancelled = true; render?.cancel(); void task.destroy(); };
  }, [url, pageNumber]);
  return <>{error && <p role="alert" className="bl-error">{error}</p>}<canvas ref={canvas} aria-label={`PDF page ${pageNumber}`} /></>;
}
