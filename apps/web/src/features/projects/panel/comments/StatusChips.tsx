import type { CommentStatus } from "../../../board/api";
import { STATUS_META, STATUS_ORDER } from "./types";

export interface StatusChipsProps {
  activeStatus: CommentStatus | null;
  statusCounts: Record<CommentStatus, number>;
  filteredCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onStatusChipClick: (status: CommentStatus) => void;
}

export function StatusChips({
  activeStatus,
  statusCounts,
  filteredCount,
  totalCount,
  onSelectAll,
  onStatusChipClick,
}: StatusChipsProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Comments ({filteredCount}
          {filteredCount !== totalCount ? ` of ${totalCount}` : ""})
        </h3>
        <button
          onClick={onSelectAll}
          className="text-accent-primary text-xs font-medium hover:underline"
        >
          Select all
        </button>
      </div>

      <div className="text-text-muted text-[10px] font-semibold tracking-wide uppercase">
        Status
      </div>
      <div className="grid grid-cols-2 gap-2">
        {STATUS_ORDER.map((status) => {
          const meta = STATUS_META[status];
          const isActive = activeStatus === status;
          const isShown = activeStatus === null || isActive;
          return (
            <button
              key={status}
              onClick={() => onStatusChipClick(status)}
              aria-pressed={isShown}
              data-active={isActive}
              className={`flex items-center justify-between gap-2 rounded-lg border-2 px-2.5 py-2 text-xs font-medium ${meta.fill} ${
                isActive ? "border-text-primary dark:border-white" : meta.border
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                {meta.label}
              </span>
              <span>{statusCounts[status]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
