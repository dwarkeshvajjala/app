import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Dialog } from "../../components/Dialog";
import { apiFetch } from "../../lib/api-client";
import type { Schemas } from "@backline/types";
import type { ProjectOut } from "./api";

type PageOut = Schemas["PageOut"];

export function ProjectPagesModal({ project, onClose }: { project: ProjectOut; onClose: () => void }) {
  const cache = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const { data: pages, isLoading } = useQuery({
    queryKey: ["project", project.id, "pages"],
    queryFn: () => apiFetch<PageOut[]>(`/api/v1/projects/${project.id}/pages`),
  });

  const removePage = useMutation({
    mutationFn: (pageId: string) => apiFetch(`/api/v1/pages/${pageId}`, { method: "DELETE" }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["project", project.id, "pages"] }),
  });

  const updatePage = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      apiFetch(`/api/v1/pages/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
    onSuccess: () => {
      setEditingId(null);
      return cache.invalidateQueries({ queryKey: ["project", project.id, "pages"] });
    },
  });

  return (
    <Dialog title="Manage Pages" onClose={onClose}>
      <div className="p-4 w-[600px] max-w-full">
        <p className="text-sm text-text-muted mb-4">Pages registered by the Backline widget for this project.</p>
        {removePage.isError && (
          <p role="alert" className="mb-4 text-sm text-red-700">
            {removePage.error instanceof Error ? removePage.error.message : "The page could not be removed."}
          </p>
        )}
        
        {isLoading ? (
          <p>Loading...</p>
        ) : (pages ?? []).length === 0 ? (
          <p className="text-text-muted">No pages registered yet.</p>
        ) : (
          <ul className="divide-y divide-black/10 dark:divide-white/10">
            {pages!.map((page) => (
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
                        onClick={() => {
                          setEditTitle(page.title || "");
                          setEditingId(page.id);
                        }}
                        className="text-xs text-text-muted hover:text-text-primary px-2"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Remove this empty page? Pages with comments, revisions, or assets are retained.")) {
                            removePage.mutate(page.id);
                          }
                        }}
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
    </Dialog>
  );
}
