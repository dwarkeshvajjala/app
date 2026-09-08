export interface ViewOptionsBarProps {
  currentPageId: string | null;
  currentPageOnly: boolean;
  setCurrentPageOnly: (value: boolean) => void;
  hideResolved: boolean;
  setHideResolved: (value: boolean) => void;
  displayMode: "comfortable" | "compact";
  setDisplayMode: (mode: "comfortable" | "compact") => void;
  groupBy: "none" | "page";
  setGroupBy: (groupBy: "none" | "page") => void;
}

export function ViewOptionsBar({
  currentPageId,
  currentPageOnly,
  setCurrentPageOnly,
  hideResolved,
  setHideResolved,
  displayMode,
  setDisplayMode,
  groupBy,
  setGroupBy,
}: ViewOptionsBarProps) {
  return (
    <div className="flex flex-col gap-3 border-b pb-3" style={{ borderColor: "var(--line-soft)" }}>
      <div className="flex flex-col gap-2">
        <label
          className="bl-check"
          style={!currentPageId ? { color: "var(--ink-4)" } : undefined}
          title={currentPageId ? undefined : "Load a page in the canvas first"}
        >
          <input
            type="checkbox"
            checked={currentPageOnly}
            disabled={!currentPageId}
            onChange={(event) => setCurrentPageOnly(event.target.checked)}
          />
          Show comments on current page only
        </label>
        <label className="bl-check">
          <input
            type="checkbox"
            checked={hideResolved}
            onChange={(event) => setHideResolved(event.target.checked)}
          />
          Hide resolved threads
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          Display
          <select
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as "comfortable" | "compact")}
            className="bl-select"
          >
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs">
          Group by
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "none" | "page")}
            className="bl-select"
          >
            <option value="none">None</option>
            <option value="page">Page</option>
          </select>
        </label>
      </div>
    </div>
  );
}
