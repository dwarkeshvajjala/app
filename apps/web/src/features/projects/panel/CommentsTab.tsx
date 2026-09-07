import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { RefObject } from "react";

import * as boardApi from "../../board/api";
import type { CommentOut, CommentStatus } from "../../board/api";
import { API_BASE_URL } from "../../../lib/api-client";
import { qk } from "../../../lib/query-keys";
import { CommentsList } from "./comments/CommentsList";
import { FilterSortBar } from "./comments/FilterSortBar";
import { StatusChips } from "./comments/StatusChips";
import type { LayerFilter, SortOrder } from "./comments/types";
import { ViewOptionsBar } from "./comments/ViewOptionsBar";

interface CommentsTabProps {
  projectId: string;
  canvasRef: RefObject<HTMLIFrameElement | null>;
  currentPageId: string | null;
}

export function CommentsTab({ projectId, canvasRef, currentPageId }: CommentsTabProps) {
  const { data: comments, isLoading } = useQuery({
    queryKey: qk.projectComments(projectId),
    queryFn: () => boardApi.listProjectComments(projectId),
  });

  // null = show every status (the initial state) - clicking a chip isolates the list
  // down to just that one status, clicking it again (or "Select all") goes back to
  // showing everything. Not a multi-select toggle: with 4 statuses, "tap one to see just
  // that bucket" is the more useful click for triaging than gradually excluding buckets.
  const [activeStatus, setActiveStatus] = useState<CommentStatus | null>(null);
  const [hideResolved, setHideResolved] = useState(false);
  const [layerFilter, setLayerFilter] = useState<LayerFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [currentPageOnly, setCurrentPageOnly] = useState(false);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [activeDeviceTypes, setActiveDeviceTypes] = useState<string[]>([]);
  const [activeBrowsers, setActiveBrowsers] = useState<string[]>([]);
  const [activeAssignees, setActiveAssignees] = useState<string[]>([]);
  const [displayMode, setDisplayMode] = useState<"comfortable" | "compact">("comfortable");
  const [groupBy, setGroupBy] = useState<"none" | "page">("none");

  const allThreads = (comments ?? []).filter((c) => !c.parent_id);

  // Numeric badge order is stable across every filter/sort choice - it always reflects
  // creation order across the whole project, not the currently-visible subset - so a
  // comment's number never changes just because a filter hid its neighbors.
  const sequenceByCommentId = useMemo(() => {
    const byCreatedAsc = allThreads
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const map = new Map<string, number>();
    byCreatedAsc.forEach((c, index) => map.set(c.id, index + 1));
    return map;
  }, [allThreads]);

  const statusCounts = useMemo(() => {
    const counts: Record<CommentStatus, number> = {
      todo: 0,
      in_progress: 0,
      in_review: 0,
      blocked: 0,
      resolved: 0,
      wont_fix: 0,
    };
    for (const c of allThreads) counts[c.status] += 1;
    return counts;
  }, [allThreads]);

  const filteredThreads = allThreads.filter((c) => {
    if (hideResolved && c.status === "resolved") return false;
    if (activeStatus && c.status !== activeStatus) return false;
    if (layerFilter !== "all" && c.layer !== layerFilter) return false;
    if (currentPageOnly && c.page_id !== currentPageId) return false;
    if (activeTags.length > 0 && !activeTags.some(t => c.tags?.includes(t as NonNullable<CommentOut["tags"]>[number]))) return false;
    if (activeDeviceTypes.length > 0 && !activeDeviceTypes.includes(c.context?.device_type as string)) return false;
    if (activeBrowsers.length > 0 && !activeBrowsers.includes(c.context?.browser as string)) return false;
    if (activeAssignees.length > 0 && !activeAssignees.some(a => c.assignee_id === a || c.assignee_ids?.includes(a))) return false;
    return true;
  });

  const sortedThreads = useMemo(
    () =>
      filteredThreads
        .slice()
        .sort((a, b) =>
          sortOrder === "newest"
            ? b.created_at.localeCompare(a.created_at)
            : a.created_at.localeCompare(b.created_at),
        ),
    [filteredThreads, sortOrder],
  );

  function onStatusChipClick(status: CommentStatus) {
    setActiveStatus((prev) => (prev === status ? null : status));
  }

  // The canvas iframe is served from the API's own origin (proxy mode), not the
  // dashboard's - postMessage is the only way to reach into it (apps/widget/src/index.ts
  // listens for this exact message). Not just cosmetic: a comment whose pin never
  // rendered (off-screen, or the target hadn't loaded yet) can still genuinely exist -
  // this is how a reviewer actually finds it again.
  function navigateToComment(commentId: string) {
    canvasRef.current?.contentWindow?.postMessage(
      { type: "backline:scroll-to-comment", commentId },
      new URL(API_BASE_URL).origin,
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <StatusChips
        activeStatus={activeStatus}
        statusCounts={statusCounts}
        filteredCount={filteredThreads.length}
        totalCount={allThreads.length}
        onSelectAll={() => setActiveStatus(null)}
        onStatusChipClick={onStatusChipClick}
      />

      <FilterSortBar
        allThreads={allThreads}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        layerFilter={layerFilter}
        setLayerFilter={setLayerFilter}
        activeTags={activeTags}
        setActiveTags={setActiveTags}
        activeDeviceTypes={activeDeviceTypes}
        setActiveDeviceTypes={setActiveDeviceTypes}
        activeBrowsers={activeBrowsers}
        setActiveBrowsers={setActiveBrowsers}
        activeAssignees={activeAssignees}
        setActiveAssignees={setActiveAssignees}
      />

      <ViewOptionsBar
        currentPageId={currentPageId}
        currentPageOnly={currentPageOnly}
        setCurrentPageOnly={setCurrentPageOnly}
        hideResolved={hideResolved}
        setHideResolved={setHideResolved}
        displayMode={displayMode}
        setDisplayMode={setDisplayMode}
        groupBy={groupBy}
        setGroupBy={setGroupBy}
      />

      <CommentsList
        isLoading={isLoading}
        allThreads={allThreads}
        filteredThreads={filteredThreads}
        sortedThreads={sortedThreads}
        displayMode={displayMode}
        groupBy={groupBy}
        projectId={projectId}
        sequenceByCommentId={sequenceByCommentId}
        onNavigate={navigateToComment}
      />
    </div>
  );
}
