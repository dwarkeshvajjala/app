import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog } from "../../components/Dialog";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { apiFetch } from "../../lib/api-client";
import { qk } from "../../lib/query-keys";
import type { Schemas } from "@backline/types";
import type { ProjectOut } from "./api";

type PageOut = Schemas["PageOut"];

export function ProjectPagesModal({ project, onClose }: { project: ProjectOut; onClose: () => void }) {
  const cache = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [removeCandidate, setRemoveCandidate] = useState<PageOut | null>(null);

  const pagesKey = qk.projectPages(project.id);

  const { data: pages, isLoading } = useQuery({
    queryKey: pagesKey,
    queryFn: () => apiFetch<PageOut[]>(`/api/v1/projects/${project.id}/pages`),
  });

  const addPage = useMutation({
    mutationFn: () =>
      apiFetch<PageOut>("/api/v1/pages", {
        method: "POST",
        body: JSON.stringify({
          project_id: project.id,
          url: newUrl.trim(),
          title: newTitle.trim() || null,
        }),
      }),
    onSuccess: () => {
      setNewUrl("");
      setNewTitle("");
      return cache.invalidateQueries({ queryKey: pagesKey });
    },
  });

  const removePage = useMutation({
    mutationFn: (pageId: string) => apiFetch(`/api/v1/pages/${pageId}`, { method: "DELETE" }),
    onSuccess: () => {
      setRemoveCandidate(null);
      return cache.invalidateQueries({ queryKey: pagesKey });
    },
  });

  const updatePage = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch(`/api/v1/pages/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      setEditingId(null);
      return cache.invalidateQueries({ queryKey: pagesKey });
    },
  });

  // Reorder: pages already list sort_order-ascending (pages/service.py::list_pages).
  // Moving a page swaps it with its neighbor locally, then re-numbers every page's
  // sort_order to its new index - necessary because pages that have never been
  // reordered all default to sort_order=0 and tie-break on first_seen_at instead.
  const reorderPages = useMutation({
    mutationFn: async (reordered: PageOut[]) => {
      await Promise.all(
        reordered.map((page, index) =>
          apiFetch(`/api/v1/pages/${page.id}`, {
            method: "PATCH",
            body: JSON.stringify({ sort_order: index }),
          }),
        ),
      );
    },
    onSuccess: () => cache.invalidateQueries({ queryKey: pagesKey }),
  });

  function movePage(pageId: string, direction: -1 | 1) {
    const list = pages ?? [];
    const index = list.findIndex((p) => p.id === pageId);
    const swapIndex = index + direction;
    if (index === -1 || swapIndex < 0 || swapIndex >= list.length) return;
    const reordered = [...list];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    reorderPages.mutate(reordered);
  }

  return (
    <Dialog title="Manage Pages" onClose={onClose}>
      <div className="p-4 w-[600px] max-w-full">
        <p className="text-sm text-text-muted mb-4">Pages registered by the Backline widget for this project.</p>
        {removePage.isError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {removePage.error instanceof Error ? removePage.error.message : "The page could not be removed."}
          </p>
        )}
        {addPage.isError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {addPage.error instanceof Error ? addPage.error.message : "The page could not be added."}
          </p>
        )}

        <form
          className="mb-4 flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newUrl.trim()) addPage.mutate();
          }}
        >
          <label className="flex-1 text-xs text-text-muted">
            Page URL
            <input
              type="text"
              required
              className="bl-input mt-1 w-full"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://example.com/pricing"
            />
          </label>
          <label className="flex-1 text-xs text-text-muted">
            Title (optional)
            <input
              type="text"
              className="bl-input mt-1 w-full"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Pricing"
            />
          </label>
          <button type="submit" className="bl-button" disabled={addPage.isPending || !newUrl.trim()}>
            Add page
          </button>
        </form>

        {isLoading ? (
          <p>Loading...</p>
        ) : (pages ?? []).length === 0 ? (
          <p className="text-text-muted">No pages registered yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {pages!.map((page, index) => (
              <li key={page.id} className="py-3 flex items-center justify-between">
                {editingId === page.id ? (
                  <form
                    className="flex-1 flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      updatePage.mutate({ id: page.id, title: editTitle });
                    }}
                  >
                    <input
                      type="text"
                      className="bl-input flex-1"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder={page.url_normalized}
                      autoFocus
                    />
                    <button type="submit" className="bl-button" disabled={updatePage.isPending}>Save</button>
                    <button type="button" className="bl-quiet" onClick={() => setEditingId(null)}>Cancel</button>
                  </form>
                ) : (
                  <>
                    <div className="min-w-0 flex-1 pr-4">
                      <p className="truncate font-medium text-sm">{page.title || page.url_normalized}</p>
                      <p className="truncate text-xs text-text-muted">{page.url_normalized}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => movePage(page.id, -1)}
                        disabled={index === 0 || reorderPages.isPending}
                        aria-label={`Move ${page.title || page.url_normalized} up`}
                        className="text-xs text-text-muted hover:text-text-primary px-1 disabled:opacity-30"
                      >
                        Up
                      </button>
                      <button
                        onClick={() => movePage(page.id, 1)}
                        disabled={index === pages!.length - 1 || reorderPages.isPending}
                        aria-label={`Move ${page.title || page.url_normalized} down`}
                        className="text-xs text-text-muted hover:text-text-primary px-1 disabled:opacity-30"
                      >
                        Down
                      </button>
                      <button
                        onClick={() => {
                          setEditTitle(page.title || "");
                          setEditingId(page.id);
                        }}
                        className="text-xs text-text-muted hover:text-text-primary px-2"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => setRemoveCandidate(page)}
                        disabled={removePage.isPending}
                        className="text-xs text-red-600 hover:text-red-700 px-2"
                      >
                        Remove
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {removeCandidate && (
        <ConfirmDialog
          title="Remove page"
          message="Remove this empty page? Pages with comments, revisions, or assets are retained."
          confirmLabel={removePage.isPending ? "Removing..." : "Remove"}
          destructive
          pending={removePage.isPending}
          onCancel={() => setRemoveCandidate(null)}
          onConfirm={() => removePage.mutate(removeCandidate.id)}
        />
      )}
    </Dialog>
  );
}
