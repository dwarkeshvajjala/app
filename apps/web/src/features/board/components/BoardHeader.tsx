import { WORKFLOW_STATUSES as STATUSES, STATUS_LABELS } from "../../../lib/workflow";
import type { MemberOut } from "../../workspaces/api";
import { CONNECTION_DOT, CONNECTION_LABEL, type Filters } from "./types";

interface BoardHeaderProps {
  connectionStatus: string;
  view: "kanban" | "list";
  setView: (next: "kanban" | "list") => void;
  filters: Filters;
  setFilter: (key: keyof Filters, value: string) => void;
  members: MemberOut[] | undefined;
  pageUrls: string[];
  reviewerCountByUrl: Map<string, number>;
}

export function BoardHeader({
  connectionStatus,
  view,
  setView,
  filters,
  setFilter,
  members,
  pageUrls,
  reviewerCountByUrl,
}: BoardHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Board</h1>
          <span className="text-text-muted flex items-center gap-1.5 text-xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${CONNECTION_DOT[connectionStatus]}`}
              aria-hidden="true"
            />
            {CONNECTION_LABEL[connectionStatus]}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setView("kanban")}
            className={`rounded-md px-3 py-1.5 text-sm ${view === "kanban" ? "bg-accent-primary text-white" : "border border-black/10 dark:border-white/10"}`}
          >
            Kanban
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded-md px-3 py-1.5 text-sm ${view === "list" ? "bg-accent-primary text-white" : "border border-black/10 dark:border-white/10"}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
          aria-label="Filter by status"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          value={filters.layer}
          onChange={(e) => setFilter("layer", e.target.value)}
          aria-label="Filter by layer"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All layers</option>
          <option value="client">Client visible</option>
          <option value="team">Team only</option>
        </select>
        <select
          value={filters.assignee}
          onChange={(e) => setFilter("assignee", e.target.value)}
          aria-label="Filter by assignee"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All assignees</option>
          {(members ?? []).map((member) => (
            <option key={member.id} value={member.user_id}>
              {member.name}
            </option>
          ))}
        </select>
        <select
          value={filters.device}
          onChange={(e) => setFilter("device", e.target.value)}
          aria-label="Filter by device"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All devices</option>
          <option value="desktop">Desktop</option>
          <option value="mobile">Mobile</option>
          <option value="tablet">Tablet</option>
        </select>
        <select
          value={filters.page}
          onChange={(e) => setFilter("page", e.target.value)}
          aria-label="Filter by page"
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 text-xs dark:border-white/10"
        >
          <option value="">All pages</option>
          {pageUrls.map((url) => {
            const reviewerCount = reviewerCountByUrl.get(url) ?? 0;
            return (
              <option key={url} value={url}>
                {url}
                {reviewerCount > 0 ? ` (${reviewerCount} reviewing)` : ""}
              </option>
            );
          })}
        </select>
      </div>
    </>
  );
}
