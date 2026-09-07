import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { qk } from "../../lib/query-keys";
import { createWorkspace, listWorkspaces } from "./api";
import type { WorkspaceOut } from "./api";
import { useOnClickOutside } from "../../lib/use-click-outside";

interface WorkspaceSwitcherPopoverProps {
  currentWorkspace: WorkspaceOut;
  onClose: () => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function WorkspaceSwitcherPopover({
  currentWorkspace,
  onClose,
}: WorkspaceSwitcherPopoverProps) {
  const { switchWorkspace } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const popRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLButtonElement[]>([]);
  const [focusIndex, setFocusIndex] = useState(-1);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const { data: workspaces = [] } = useQuery({
    queryKey: qk.workspaces(),
    queryFn: listWorkspaces,
  });

  // Close on outside click
  useOnClickOutside(popRef, onClose);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSwitch(ws: WorkspaceOut) {
    if (ws.id === currentWorkspace.id) {
      onClose();
      return;
    }
    await switchWorkspace(ws.id);
    navigate(`/w/${ws.slug}`);
    onClose();
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const ws = await createWorkspace(newName.trim());
      await queryClient.invalidateQueries({ queryKey: qk.workspaces() });
      await switchWorkspace(ws.id);
      navigate(`/w/${ws.slug}`);
      onClose();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Could not create workspace.");
    } finally {
      setCreating(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = Math.min(focusIndex + 1, workspaces.length - 1);
      setFocusIndex(next);
      itemsRef.current[next]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.max(focusIndex - 1, 0);
      setFocusIndex(next);
      itemsRef.current[next]?.focus();
    }
  }

  const slugPreview = newName ? slugify(newName) : "";

  return (
    <div
      ref={popRef}
      className="bl-ws-pop"
      role="dialog"
      aria-label="Switch workspace"
      onKeyDown={handleKeyDown}
    >
      <div className="bl-ws-pop-list" role="listbox" aria-label="Workspaces">
        {workspaces.map((ws, i) => (
          <button
            key={ws.id}
            ref={(el) => { if (el) itemsRef.current[i] = el; }}
            className={`bl-ws-item${ws.id === currentWorkspace.id ? " selected" : ""}`}
            role="option"
            aria-selected={ws.id === currentWorkspace.id}
            onClick={() => void handleSwitch(ws)}
          >
            <span className="bl-ws-item-check" aria-hidden="true">
              {ws.id === currentWorkspace.id ? "✓" : ""}
            </span>
            <span>{ws.name}</span>
            <span className="bl-mono" style={{ marginLeft: "auto" }}>{ws.role}</span>
          </button>
        ))}
      </div>

      <form className="bl-ws-create-form" onSubmit={(e) => void handleCreate(e)}>
        <p className="bl-eyebrow" style={{ margin: 0 }}>New workspace</p>
        <input
          className="bl-input"
          placeholder="Workspace name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={120}
          required
        />
        {slugPreview && (
          <p className="bl-ws-slug-preview">Slug: {slugPreview}</p>
        )}
        {createError && (
          <p className="bl-error" role="alert" style={{ margin: 0 }}>{createError}</p>
        )}
        <button
          type="submit"
          className="bl-button"
          disabled={creating || !newName.trim()}
        >
          {creating ? "Creating…" : "Create"}
        </button>
      </form>
    </div>
  );
}
