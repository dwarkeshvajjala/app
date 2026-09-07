import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { qk } from "../../lib/query-keys";
import { searchWorkspace } from "./api";

export function GlobalSearch({ workspaceId, workspaceSlug }: { workspaceId: string; workspaceSlug: string }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const activeQuery = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: qk.search(workspaceId, activeQuery),
    queryFn: () => searchWorkspace(workspaceId, activeQuery),
    enabled: activeQuery.length > 0,
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && document.activeElement?.tagName !== "INPUT")) {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === "Escape") { setQuery(""); input.current?.blur(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function open(result: NonNullable<typeof data>["items"][number]) {
    const base = `/w/${workspaceSlug}`;
    if (result.kind === "project") navigate(`${base}/p/${result.project_id}`);
    else if (result.kind === "member") navigate(`${base}/members`);
    else navigate(`${base}/tickets?comment_id=${encodeURIComponent(result.id)}`);
    setQuery("");
  }

  return <div className="bl-global-search">
    <label className="bl-search"><span aria-hidden="true">⌕</span><input ref={input} aria-label="Search this workspace" placeholder="Search projects, comments, or people…" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>⌘K</kbd></label>
    {activeQuery && <section className="bl-search-popover" aria-label="Search results">
      {isFetching && <p>Searching…</p>}
      {!isFetching && data?.items.length === 0 && <p>No results in this workspace.</p>}
      {data?.items.map((result) => <button key={`${result.kind}-${result.id}`} onClick={() => open(result)}><span><strong>{result.title}</strong><small>{result.subtitle}</small></span><em>{result.kind}</em></button>)}
    </section>}
  </div>;
}
