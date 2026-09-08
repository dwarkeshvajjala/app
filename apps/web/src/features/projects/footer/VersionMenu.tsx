import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { formatDate } from "../../../lib/date-format";
import { useOnClickOutside } from "../../../lib/use-click-outside";
import * as api from "../api";
import { ChevronIcon } from "../panel/icons";

interface VersionMenuProps {
  projectId: string;
  currentPageId: string | null;
  onSelectPage: (pageId: string) => void;
}

export function VersionMenu({ projectId, currentPageId, onSelectPage }: VersionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => setOpen(false));
  const revisions = useQuery({
    queryKey: ["project", projectId, "revisions"],
    queryFn: ({ signal }) => api.listRevisions(projectId, signal),
    enabled: open,
  });
  const currentPageRevisions = (revisions.data ?? []).filter((item) => item.page_id === currentPageId);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium dark:border-white/10">
        {currentPageRevisions.length ? `${currentPageRevisions.length} versions` : "Version history"}
        <ChevronIcon width={12} height={12} className={open ? "rotate-180" : ""} />
      </button>
      {open && (
        <div role="menu" className="bg-bg-surface absolute bottom-full left-0 z-40 mb-2 max-h-80 w-96 overflow-y-auto rounded-lg border border-black/10 p-3 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
          <header className="mb-3"><strong className="text-sm">Captured versions</strong><p className="text-text-muted text-xs">Meaningful DOM revisions from the existing snapshot and recovery pipeline.</p></header>
          {revisions.isLoading && <p role="status" className="text-sm">Loading history…</p>}
          {revisions.error && <p role="alert" className="bl-error">{revisions.error.message}</p>}
          {!revisions.isLoading && !revisions.error && (revisions.data ?? []).length === 0 && <p className="text-text-muted text-sm">No snapshots have produced a version yet.</p>}
          <ol className="space-y-2">
            {revisions.data?.map((revision) => {
              const changed = revision.changes.moved + revision.changes.modified + revision.changes.removed + revision.changes.added;
              const recoveryIssues = revision.recovery.low_confidence + revision.recovery.orphaned + revision.recovery.permanently_orphaned;
              return (
                <li key={revision.id}>
                  <button role="menuitem" className={`w-full rounded-lg border p-2 text-left text-xs ${revision.page_id === currentPageId ? "border-accent-primary" : "border-black/10 dark:border-white/10"}`} onClick={() => { onSelectPage(revision.page_id); setOpen(false); }}>
                    <span className="flex items-center justify-between gap-2"><strong className="truncate">{revision.page_title || revision.page_url}</strong>{revision.is_current && <span className="bl-chip">Current</span>}</span>
                    <span className="text-text-muted mt-1 block">{formatDate(revision.captured_at, { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span className="text-text-muted mt-1 block">{changed} DOM changes · {recoveryIssues ? `${recoveryIssues} anchors need attention` : `${revision.recovery.ok} anchors recovered`}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
