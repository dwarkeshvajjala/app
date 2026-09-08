import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { qk } from "../../lib/query-keys";
import { searchWorkspace } from "./api";
import type { SearchResults } from "./api";
import { useOnClickOutside } from "../../lib/use-click-outside";
import { SearchIcon } from "../../components/icons";

type SearchItem = SearchResults["items"][number];

const SECTION_LABELS: Record<string, string> = {
  project: "Projects",
  comment: "Comments",
  ticket: "Tickets",
  member: "Members",
};

function groupResults(items: SearchItem[]): Array<{ section: string; items: SearchItem[] }> {
  const order = ["project", "ticket", "comment", "member"];
  const byKind: Record<string, SearchItem[]> = {};
  for (const item of items) {
    (byKind[item.kind] ??= []).push(item);
  }
  return order.filter((k) => byKind[k]?.length).map((k) => ({ section: k, items: byKind[k] }));
}

export function GlobalSearch({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const popover = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";

  // FE-05/BE-05: fetch on pause, not per keystroke - the input itself stays
  // immediate (uncontrolled lag would feel broken), only the network request lags.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const activeQuery = debouncedQuery;
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: qk.search(workspaceId, activeQuery),
    queryFn: () => searchWorkspace(workspaceId, activeQuery),
    enabled: activeQuery.length > 0,
  });

  // Flatten grouped items for keyboard navigation
  const grouped = query.trim() && activeQuery === query.trim() ? groupResults(data?.items ?? []) : [];
  const flatItems = grouped.flatMap((group) => group.items);

  useEffect(() => {
    setActiveIndex(0);
  }, [data]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  useOnClickOutside(containerRef, () => setQuery(""));

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLElement && (event.target.isContentEditable || !!event.target.closest("input, textarea, select"));
      if ((event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !editing && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === "Escape") {
        setQuery("");
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function getResultRoute(result: SearchItem): string {
    const base = `/w/${workspaceSlug}`;
    if (result.kind === "project") return `${base}/p/${result.project_id}`;
    if (result.kind === "member") return `${base}/members`;
    // comment and ticket both navigate to the tickets view with the comment selected
    if (result.project_id) {
      return `${base}/p/${result.project_id}/board?comment=${encodeURIComponent(result.id)}`;
    }
    return `${base}/tickets?ticket=${encodeURIComponent(result.id)}`;
  }

  function open(result: SearchItem) {
    navigate(getResultRoute(result));
    setQuery("");
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!flatItems.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter") {
      const item = flatItems[activeIndex];
      if (item) open(item);
    }
  }


  return (
    <div className="bl-global-search" ref={containerRef}>
      <label className="bl-search">
        <span className="bl-search-icon" aria-hidden="true"><SearchIcon /></span>
        <input
          ref={input}
          aria-label="Search this workspace"
          maxLength={200}
          aria-controls="bl-search-results"
          aria-activedescendant={flatItems[activeIndex] ? `bl-sr-${flatItems[activeIndex].id}` : undefined}
          placeholder="Search projects, comments, or people…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleInputKeyDown}
          role="combobox"
          aria-expanded={!!query.trim()}
          aria-autocomplete="list"
        />
        <kbd title="Search: / or Cmd/Ctrl+K">/ · {shortcut}</kbd>
      </label>
      {query.trim() && (
        <section
          id="bl-search-results"
          ref={popover}
          className="bl-search-popover"
          aria-label="Search results"
          role="listbox"
        >
          {isFetching && <p>Searching…</p>}
          {isError && <p role="alert">Search failed. <button onClick={() => void refetch()}>Retry</button></p>}
          {!isError && !isFetching && activeQuery === query.trim() && flatItems.length === 0 && <p>No results in this workspace.</p>}
          {grouped.map(({ section, items }) => (
            <div key={section} className="bl-search-section">
              <p className="bl-search-section-label">{SECTION_LABELS[section] ?? section}</p>
              {items.map((result) => {
                const flatIdx = flatItems.indexOf(result);
                return (
                  <button
                    key={`${result.kind}-${result.id}`}
                    id={`bl-sr-${result.id}`}
                    role="option"
                    aria-selected={flatIdx === activeIndex}
                    className={flatIdx === activeIndex ? "is-active" : ""}
                    onClick={() => open(result)}
                    tabIndex={-1}
                  >
                    <span>
                      <strong>{result.title}</strong>
                      <small>{result.subtitle}</small>
                    </span>
                    <em>{result.kind}</em>
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
