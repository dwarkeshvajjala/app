import { LayerBadge, RecoveryBadge, StatusBadge } from "@backline/ui";

import { WORKFLOW_STATUSES as STATUSES, STATUS_LABELS } from "../../../lib/workflow";
import type { CommentOut, CommentStatus } from "../api";

interface ListTableProps {
  filtered: CommentOut[];
  selected: Set<string>;
  setSelected: (next: Set<string>) => void;
  toggleSelected: (id: string) => void;
  memberName: (userId: string | null) => string | null;
  repliesByParent: Map<string, CommentOut[]>;
  setOpenThreadId: (id: string | null) => void;
  bulkUpdateMutation: {
    mutate: (status: CommentStatus) => void;
  };
}

export function ListTable({
  filtered,
  selected,
  setSelected,
  toggleSelected,
  memberName,
  repliesByParent,
  setOpenThreadId,
  bulkUpdateMutation,
}: ListTableProps) {
  return (
    <div className="mt-6">
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <span className="text-text-muted text-xs">{selected.size} selected</span>
          <select
            onChange={(e) => {
              if (e.target.value) bulkUpdateMutation.mutate(e.target.value as CommentStatus);
              e.target.value = "";
            }}
            aria-label="Change status for selected comments"
            className="rounded border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
          >
            <option value="">Change status to...</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-text-muted border-b border-black/10 text-xs dark:border-white/10">
            <th className="w-8 py-2">
              <input
                type="checkbox"
                checked={selected.size > 0 && selected.size === filtered.length}
                onChange={(e) =>
                  setSelected(e.target.checked ? new Set(filtered.map((c) => c.id)) : new Set())
                }
                aria-label="Select all comments"
              />
            </th>
            <th className="py-2">Comment</th>
            <th className="py-2">Layer</th>
            <th className="py-2">Status</th>
            <th className="py-2">Assignee</th>
            <th className="py-2">Anchor</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((comment) => (
            <tr key={comment.id} className="border-b border-black/5 dark:border-white/5">
              <td className="py-2">
                <input
                  type="checkbox"
                  checked={selected.has(comment.id)}
                  onChange={() => toggleSelected(comment.id)}
                  aria-label={`Select comment: ${comment.body.slice(0, 60)}`}
                />
              </td>
              <td className="max-w-xs truncate py-2">
                <button
                  onClick={() => setOpenThreadId(comment.id)}
                  className="hover:underline"
                >
                  {comment.body}
                  {(repliesByParent.get(comment.id)?.length ?? 0) > 0 && (
                    <span className="text-text-muted ml-1 text-xs">
                      ({repliesByParent.get(comment.id)?.length})
                    </span>
                  )}
                </button>
              </td>
              <td className="py-2">
                <LayerBadge layer={comment.layer} />
              </td>
              <td className="py-2">
                <StatusBadge status={comment.status} />
              </td>
              <td className="py-2">{memberName(comment.assignee_id) ?? "Unassigned"}</td>
              <td className="py-2">
                <RecoveryBadge status={comment.recovery_status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
