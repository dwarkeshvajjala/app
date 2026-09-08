import { useEffect, useRef, useState } from "react";

import type { CommentOut } from "../../../board/api";
import type { MemberOut } from "../../../workspaces/api";
import { FilterIcon, SortIcon } from "../icons";
import { COMMENT_TAGS, DEVICE_TYPE_LABELS, commentBrowser, commentDeviceType } from "./types";
import type { LayerFilter, SortOrder } from "./types";

export interface FilterSortBarProps {
  allThreads: CommentOut[];
  members: MemberOut[];
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

const SORT_OPTIONS: { id: SortOrder; label: string }[] = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
];

const LAYER_OPTIONS: { id: LayerFilter; label: string }[] = [
  { id: "all", label: "All layers" },
  { id: "client", label: "Client visible" },
  { id: "team", label: "Team only" },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Tick() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path d="M3 8.5 6.5 12 13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FilterSortBar({
  allThreads,
  members,
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
  const [openMenu, setOpenMenu] = useState<"sort" | "filter" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenMenu(null);
    }
    document.addEventListener("click", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("click", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  const deviceTypes = Array.from(
    new Set(allThreads.map(commentDeviceType).filter((value): value is string => Boolean(value))),
  );
  const browsers = Array.from(
    new Set(allThreads.map(commentBrowser).filter((value): value is string => Boolean(value))),
  );
  const assignedMembers = members.filter((member) =>
    allThreads.some((c) => c.assignee_id === member.user_id || c.assignee_ids?.includes(member.user_id)),
  );

  const filterCount =
    (layerFilter !== "all" ? 1 : 0) +
    activeTags.length +
    activeDeviceTypes.length +
    activeBrowsers.length +
    activeAssignees.length;

  function clearAllFilters() {
    setLayerFilter("all");
    setActiveTags([]);
    setActiveDeviceTypes([]);
    setActiveBrowsers([]);
    setActiveAssignees([]);
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--line-soft)" }}>
      <div className="bl-comment-popover-anchor">
        <button
          type="button"
          className="bl-review-control"
          onClick={() => setOpenMenu((menu) => (menu === "sort" ? null : "sort"))}
          aria-haspopup="true"
          aria-expanded={openMenu === "sort"}
        >
          <SortIcon width={13} height={13} />
          Sort
        </button>
        {openMenu === "sort" && (
          <div className="bl-comment-popover" role="menu">
            <div className="bl-review-popover-label">Sort by</div>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={sortOrder === option.id}
                onClick={() => {
                  setSortOrder(option.id);
                  setOpenMenu(null);
                }}
                className="bl-review-menu-row"
              >
                {option.label}
                {sortOrder === option.id && <Tick />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="bl-comment-popover-anchor">
        <button
          type="button"
          className="bl-review-control"
          onClick={() => setOpenMenu((menu) => (menu === "filter" ? null : "filter"))}
          aria-haspopup="true"
          aria-expanded={openMenu === "filter"}
        >
          <FilterIcon width={13} height={13} />
          Filter
          {filterCount > 0 && <span className="bl-count">{filterCount}</span>}
        </button>
        {openMenu === "filter" && (
          <div className="bl-comment-popover is-wide" role="menu">
            <div className="bl-review-popover-label">Layer</div>
            {LAYER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={layerFilter === option.id}
                onClick={() => setLayerFilter(option.id)}
                className="bl-review-menu-row"
              >
                {option.label}
                {layerFilter === option.id && <Tick />}
              </button>
            ))}

            <div className="bl-review-popover-label">Tags</div>
            {COMMENT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                role="menuitemcheckbox"
                aria-checked={activeTags.includes(tag)}
                onClick={() => setActiveTags(toggle(activeTags, tag))}
                className="bl-review-menu-row"
              >
                {tag}
                {activeTags.includes(tag) && <Tick />}
              </button>
            ))}

            {deviceTypes.length > 0 && (
              <>
                <div className="bl-review-popover-label">Device</div>
                {deviceTypes.map((device) => (
                  <button
                    key={device}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={activeDeviceTypes.includes(device)}
                    onClick={() => setActiveDeviceTypes(toggle(activeDeviceTypes, device))}
                    className="bl-review-menu-row"
                  >
                    {DEVICE_TYPE_LABELS[device] ?? device}
                    {activeDeviceTypes.includes(device) && <Tick />}
                  </button>
                ))}
              </>
            )}

            {browsers.length > 0 && (
              <>
                <div className="bl-review-popover-label">Browser</div>
                {browsers.map((browser) => (
                  <button
                    key={browser}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={activeBrowsers.includes(browser)}
                    onClick={() => setActiveBrowsers(toggle(activeBrowsers, browser))}
                    className="bl-review-menu-row"
                  >
                    {browser}
                    {activeBrowsers.includes(browser) && <Tick />}
                  </button>
                ))}
              </>
            )}

            {assignedMembers.length > 0 && (
              <>
                <div className="bl-review-popover-label">Assignee</div>
                {assignedMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={activeAssignees.includes(member.user_id)}
                    onClick={() => setActiveAssignees(toggle(activeAssignees, member.user_id))}
                    className="bl-review-menu-row"
                  >
                    {member.name || member.email}
                    {activeAssignees.includes(member.user_id) && <Tick />}
                  </button>
                ))}
              </>
            )}

            {filterCount > 0 && (
              <div className="bl-comment-popover-foot">
                <button type="button" className="bl-text-link" onClick={clearAllFilters}>
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
