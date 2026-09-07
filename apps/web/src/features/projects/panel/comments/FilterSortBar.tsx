import { useEffect, useRef, useState } from "react";

import type { CommentOut } from "../../../board/api";
import { FilterIcon, SortIcon } from "../icons";
import type { LayerFilter, SortOrder } from "./types";

export interface FilterSortBarProps {
  allThreads: CommentOut[];
  sortOrder: SortOrder;
  setSortOrder: (order: SortOrder) => void;
  layerFilter: LayerFilter;
  setLayerFilter: (filter: LayerFilter) => void;
  activeTags: string[];
  setActiveTags: (tags: string[]) => void;
  activeDeviceTypes: string[];
  setActiveDeviceTypes: (types: string[]) => void;
  activeBrowsers: string[];
  setActiveBrowsers: (browsers: string[]) => void;
  activeAssignees: string[];
  setActiveAssignees: (assignees: string[]) => void;
}

export function FilterSortBar({
  allThreads,
  sortOrder,
  setSortOrder,
  layerFilter,
  setLayerFilter,
  activeTags,
  setActiveTags,
  activeDeviceTypes,
  setActiveDeviceTypes,
  activeBrowsers,
  setActiveBrowsers,
  activeAssignees,
  setActiveAssignees,
}: FilterSortBarProps) {
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setShowFilterMenu(false);
      }
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  return (
    <div className="flex items-center gap-2 border-b border-black/10 pb-3 dark:border-white/10">
      <div className="relative" ref={sortMenuRef}>
        <button
          onClick={() => {
            setShowSortMenu((prev) => !prev);
            setShowFilterMenu(false);
          }}
          className="border-black/8 text-text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          <SortIcon width={13} height={13} />
          Sort
        </button>
        {showSortMenu && (
          <div className="bg-bg-surface absolute top-8 left-0 z-10 w-40 rounded-md border border-black/10 py-1 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
            {(["newest", "oldest"] as SortOrder[]).map((order) => (
              <button
                key={order}
                onClick={() => {
                  setSortOrder(order);
                  setShowSortMenu(false);
                }}
                className={`hover:bg-bg-canvas block w-full px-3 py-1.5 text-left text-sm ${
                  sortOrder === order ? "text-accent-primary font-medium" : ""
                }`}
              >
                {order === "newest" ? "Newest first" : "Oldest first"}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative" ref={filterMenuRef}>
        <button
          onClick={() => {
            setShowFilterMenu((prev) => !prev);
            setShowSortMenu(false);
          }}
          className="border-black/8 text-text-muted flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/10"
        >
          <FilterIcon width={13} height={13} />
          Filter
          {(() => {
            const count = (layerFilter !== "all" ? 1 : 0) + activeTags.length + activeDeviceTypes.length + activeBrowsers.length + activeAssignees.length;
            return count > 0 ? <span className="bg-accent-primary text-white rounded-full px-1.5 py-0.5 text-[9px] leading-none">{count}</span> : null;
          })()}
        </button>
        {showFilterMenu && (
          <div className="bg-bg-surface absolute top-8 left-0 z-10 w-64 rounded-md border border-black/10 p-3 shadow-lg dark:border-white/10 dark:bg-[#14141A] flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-xs font-medium">
              Layer
              <select
                value={layerFilter}
                onChange={(e) => setLayerFilter(e.target.value as LayerFilter)}
                className="rounded border border-black/10 px-2 py-1 dark:border-white/10 dark:bg-transparent"
              >
                <option value="all">All layers</option>
                <option value="client">Client visible</option>
                <option value="team">Team only</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium">
              Tags
              <select
                multiple
                size={3}
                value={activeTags}
                onChange={(e) => setActiveTags(Array.from(e.target.selectedOptions).map(o => o.value))}
                className="rounded border border-black/10 px-2 py-1 dark:border-white/10 dark:bg-transparent"
              >
                {["Bug", "Copy", "Design", "Responsive", "Content", "Accessibility"].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-xs font-medium">
              Browsers
              <select
                multiple
                size={2}
                value={activeBrowsers}
                onChange={(e) => setActiveBrowsers(Array.from(e.target.selectedOptions).map(o => o.value))}
                className="rounded border border-black/10 px-2 py-1 dark:border-white/10 dark:bg-transparent"
              >
                {Array.from(new Set(allThreads.map(c => c.context?.browser as string).filter(Boolean))).map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="text-xs text-text-muted hover:text-text-primary text-left"
              onClick={() => {
                setLayerFilter("all");
                setActiveTags([]);
                setActiveDeviceTypes([]);
                setActiveBrowsers([]);
                setActiveAssignees([]);
              }}
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
