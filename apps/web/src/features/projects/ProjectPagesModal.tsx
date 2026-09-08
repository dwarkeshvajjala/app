import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Dialog } from "../../components/Dialog";
import { useToast } from "../../components/Toast";
import type { ProjectOut } from "./api";
import * as api from "./api";

interface ProjectPagesModalProps {
  project: ProjectOut;
  activePageId: string | null;
  onClose: () => void;
  onOpenPage: (pageId: string) => void;
}

export function ProjectPagesModal({ project, activePageId, onClose, onOpenPage }: ProjectPagesModalProps) {
  const cache = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [removeTarget, setRemoveTarget] = useState<api.PageOut | null>(null);
  const queryKey = ["project", project.id, "pages"];

  const pagesQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.listPages(project.id, signal),
  });
  const createPage = useMutation({
    mutationFn: () => api.createPage(project.id, { url: newUrl.trim(), title: newTitle.trim() || null }),
    onSuccess: async (page) => {
      setNewTitle("");
      setNewUrl("");
      await cache.invalidateQueries({ queryKey });
      toast("Page added.");
      onOpenPage(page.id);
    },
  });
  const updatePage = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => api.updatePage(id, { title: title.trim() || null }),
    onSuccess: async () => {
      setEditingId(null);
      await cache.invalidateQueries({ queryKey });
      toast("Page renamed.");
    },
  });
  const reorderPages = useMutation({
    mutationFn: (pageIds: string[]) => api.reorderPages(project.id, pageIds),
    onSuccess: (pages) => {
      cache.setQueryData(queryKey, pages);
      toast("Page order updated.");
    },
  });
  const removePage = useMutation({
    mutationFn: (pageId: string) => api.removePage(pageId),
    onSuccess: async (_, pageId) => {
      setRemoveTarget(null);
      await cache.invalidateQueries({ queryKey });
      if (activePageId === pageId) onOpenPage("");
      toast("Empty page removed.");
    },
  });

  const pages = pagesQuery.data ?? [];
  const operationError = pagesQuery.error ?? createPage.error ?? updatePage.error ?? reorderPages.error ?? removePage.error;

  function movePage(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= pages.length) return;
    const next = pages.map((page) => page.id);
    [next[index], next[destination]] = [next[destination], next[index]];
    reorderPages.mutate(next);
  }

  return (
    <>
      <Dialog title="Manage pages" onClose={onClose}>
        <div className="w-[680px] max-w-full p-4">
          <p className="text-text-muted mb-4 text-sm">
            Add website pages, choose the active preview, and manage their dashboard order.
            Widget registration remains automatic for reviewer visits.
          </p>
          <form className="bl-form bl-flush mb-5" onSubmit={(event) => { event.preventDefault(); createPage.mutate(); }}>
            <div className="bl-fields">
              <label>Page title<input className="bl-input" value={newTitle} maxLength={500} onChange={(event) => setNewTitle(event.target.value)} placeholder="Pricing" /></label>
              <label>Page URL<input className="bl-input" type="url" required value={newUrl} maxLength={2000} onChange={(event) => setNewUrl(event.target.value)} placeholder={`${project.target_origin}/pricing`} /></label>
            </div>
            <button className="bl-button" disabled={createPage.isPending || !newUrl.trim()}>{createPage.isPending ? "Adding…" : "Add page"}</button>
          </form>
          {operationError && <p role="alert" className="bl-error mb-4">{operationError instanceof Error ? operationError.message : "The page change failed."}</p>}
          {pagesQuery.isLoading ? <p role="status">Loading pages…</p> : pages.length === 0 ? (
            <div className="bl-empty"><h2>No pages registered</h2><p>Add the first URL above. It will become a shareable preview selection.</p></div>
          ) : (
            <ol className="divide-y divide-black/10 dark:divide-white/10">
              {pages.map((page, index) => (
                <li key={page.id} className="flex items-center gap-3 py-3">
                  <span className="bl-mono w-6 text-center" aria-hidden="true">{index + 1}</span>
                  {editingId === page.id ? (
                    <form className="flex flex-1 items-center gap-2" onSubmit={(event) => { event.preventDefault(); updatePage.mutate({ id: page.id, title: editTitle }); }}>
                      <label className="sr-only" htmlFor={`page-title-${page.id}`}>Page title</label>
                      <input id={`page-title-${page.id}`} className="bl-input flex-1" value={editTitle} maxLength={500} onChange={(event) => setEditTitle(event.target.value)} placeholder={page.url_normalized} autoFocus />
                      <button className="bl-button" disabled={updatePage.isPending}>Save</button>
                      <button type="button" className="bl-quiet" onClick={() => setEditingId(null)}>Cancel</button>
                    </form>
                  ) : (
                    <>
                      <button className="min-w-0 flex-1 text-left" aria-current={activePageId === page.id ? "page" : undefined} onClick={() => onOpenPage(page.id)}>
                        <span className="block truncate text-sm font-medium">{page.title || page.url_normalized}{activePageId === page.id && <span className="bl-chip ml-2">Open</span>}</span>
                        <span className="text-text-muted block truncate text-xs">{page.url_normalized} · {page.comment_count} comments</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button className="bl-icon" aria-label={`Move ${page.title || page.url_normalized} up`} disabled={index === 0 || reorderPages.isPending} onClick={() => movePage(index, -1)}>↑</button>
                        <button className="bl-icon" aria-label={`Move ${page.title || page.url_normalized} down`} disabled={index === pages.length - 1 || reorderPages.isPending} onClick={() => movePage(index, 1)}>↓</button>
                        <button className="bl-quiet" onClick={() => { setEditTitle(page.title || ""); setEditingId(page.id); }}>Rename</button>
                        <button className="bl-quiet text-red-600" onClick={() => setRemoveTarget(page)}>Remove</button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Dialog>
      {removeTarget && (
        <Dialog title="Remove empty page?" onClose={() => setRemoveTarget(null)}>
          <div className="bl-form">
            <p>Backline will remove <strong>{removeTarget.title || removeTarget.url_normalized}</strong> only if it has no comments, revisions, diffs, or asset references. Review history is never cascaded from this action.</p>
            {removePage.error && <p role="alert" className="bl-error">{removePage.error.message}</p>}
            <div className="bl-form-actions"><button type="button" className="bl-quiet" onClick={() => setRemoveTarget(null)}>Cancel</button><button type="button" className="bl-button" disabled={removePage.isPending} onClick={() => removePage.mutate(removeTarget.id)}>{removePage.isPending ? "Checking…" : "Remove page"}</button></div>
          </div>
        </Dialog>
      )}
    </>
  );
}
