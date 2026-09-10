import { Avatar } from "@backline/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ConfirmDialog } from "../../components/ConfirmDialog";
import { qk } from "../../lib/query-keys";
import { timeAgo } from "../../lib/time";
import * as projectsApi from "../projects/api";
import * as shareLinksApi from "../share-links/api";
import type { MemberOut } from "./api";
import type { ProjectOut } from "../projects/api";

function hostnameOf(targetOrigin: string): string {
  try {
    return new URL(targetOrigin).hostname;
  } catch {
    return targetOrigin;
  }
}

function reviewUrl(token: string): string {
  return `${window.location.origin}/review/${token}`;
}

interface ProjectCardProps {
  workspaceSlug: string;
  project: ProjectOut;
  creator: MemberOut | undefined;
  onShare: (project: ProjectOut) => void;
}

// No real per-project screenshot capture exists yet (the widget only ever screenshots
// individual comments, never a whole page for a thumbnail) - this is a deliberate
// placeholder (browser-chrome bar + the project's own initial) rather than a fake
// static image pretending to be a live preview.
export function ProjectCard({ workspaceSlug, project, creator, onShare }: ProjectCardProps) {
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied">("idle");
  const [showMenu, setShowMenu] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!showMenu) return;
    function onClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setShowMenu(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [showMenu]);

  async function handleCopy(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setCopyState("copying");
    try {
      const links = await shareLinksApi.listShareLinks(project.id);
      const active = links.find((link) => link.revoked_at === null);
      if (active) {
        await navigator.clipboard.writeText(reviewUrl(active.token));
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 2000);
        return;
      }
    } catch {
      // fall through to idle below
    }
    setCopyState("idle");
  }

  function handleShare(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setShowMenu(false);
    onShare(project);
  }

  function handleToggleMenu(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setShowMenu((prev) => !prev);
  }

  function handleArchive(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setShowMenu(false);
    // Soft-archive (still individually fetchable, never a hard delete) - but there's
    // no "unarchive" UI anywhere yet, so once it's off this list a member has no way
    // back to it through the product. A confirmation dialog is a deliberately heavier
    // bar than "Remove"/"Revoke" elsewhere in this app, which don't confirm at all.
    setConfirmArchive(true);
  }

  async function doArchive() {
    setArchiving(true);
    try {
      await projectsApi.archiveProject(project.id);
      await queryClient.invalidateQueries({ queryKey: qk.projects(project.workspace_id) });
      setConfirmArchive(false);
    } finally {
      setArchiving(false);
    }
  }

  return (
    <>
    <Link
      to={`/w/${workspaceSlug}/p/${project.id}`}
      className="group block overflow-hidden rounded-lg border border-black/10 transition-shadow hover:shadow-md dark:border-white/10"
    >
      <div className="from-bg-canvas relative h-40 bg-gradient-to-b to-white dark:to-[#0B0B0B]">
        <div className="flex items-center gap-1.5 border-b border-black/5 bg-white/60 px-3 py-2 dark:border-white/5 dark:bg-black/20">
          <span className="h-2 w-2 rounded-full bg-black/10 dark:bg-white/10" />
          <span className="h-2 w-2 rounded-full bg-black/10 dark:bg-white/10" />
          <span className="h-2 w-2 rounded-full bg-black/10 dark:bg-white/10" />
          <span className="text-text-muted ml-2 truncate text-xs">
            {hostnameOf(project.target_origin)}
          </span>
        </div>
        <div className="flex h-[calc(100%-2rem)] items-center justify-center">
          <span className="bg-accent-primary/10 text-accent-primary flex h-14 w-14 items-center justify-center rounded-full text-2xl font-semibold">
            {project.name.trim()[0]?.toUpperCase() ?? "?"}
          </span>
        </div>

        {/* Hover actions - visible on hover/focus, matching ruttl's card affordances:
            copy the client review link directly, or open the share panel. */}
        <div className="absolute inset-0 flex items-start justify-end gap-1 bg-black/0 p-2 opacity-0 transition-all group-hover:bg-black/10 group-hover:opacity-100">
          <button
            onClick={handleCopy}
            aria-label="Copy client review link"
            title={copyState === "copied" ? "Copied!" : "Copy client review link"}
            className="bg-bg-surface flex h-7 w-7 items-center justify-center rounded-md text-black/70 shadow hover:text-black dark:text-white/70 dark:hover:text-white"
          >
            {copyState === "copied" ? (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="M3 8.5 6.5 12 13 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <rect
                  x="5.5"
                  y="5.5"
                  width="8"
                  height="8"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M3.5 10V3.5A1.5 1.5 0 0 1 5 2h6.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
          <button
            onClick={handleShare}
            aria-label="Share project"
            title="Share project"
            className="bg-bg-surface flex h-7 w-7 items-center justify-center rounded-md text-black/70 shadow hover:text-black dark:text-white/70 dark:hover:text-white"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <circle cx="6" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.3" />
              <path
                d="M8.5 6.5 12 4M8.5 9.5 12 12M12 4a1.3 1.3 0 1 0 0-2.6A1.3 1.3 0 0 0 12 4Zm0 10.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleToggleMenu}
              aria-label="More actions"
              aria-haspopup="true"
              aria-expanded={showMenu}
              title="More actions"
              className="bg-bg-surface flex h-7 w-7 items-center justify-center rounded-md text-black/70 shadow hover:text-black dark:text-white/70 dark:hover:text-white"
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                <circle cx="3" cy="8" r="1.3" />
                <circle cx="8" cy="8" r="1.3" />
                <circle cx="13" cy="8" r="1.3" />
              </svg>
            </button>
            {showMenu && (
              <div className="bg-bg-surface absolute top-8 right-0 z-10 w-40 rounded-md border border-black/10 py-1 shadow-lg dark:border-white/10">
                <button
                  onClick={handleShare}
                  className="hover:bg-bg-canvas block w-full px-3 py-1.5 text-left text-sm"
                >
                  Share
                </button>
                <button
                  onClick={handleArchive}
                  className="hover:bg-bg-canvas text-recovery-orphaned block w-full px-3 py-1.5 text-left text-sm"
                >
                  Archive project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium">{project.name}</span>
          <span className="flex items-center gap-1.5">
            <Avatar name={creator?.name ?? "Unknown"} avatarUrl={creator?.avatar_url} size={16} />
            <span className="text-text-muted truncate text-xs">{creator?.name ?? "Unknown"}</span>
          </span>
        </div>
        <span className="text-text-muted shrink-0 text-xs">Updated {timeAgo(project.updated_at)}</span>
      </div>
    </Link>

    {confirmArchive && (
      <ConfirmDialog
        title="Archive project"
        message={`Archive "${project.name}"? It will no longer appear on this dashboard.`}
        confirmLabel={archiving ? "Archiving..." : "Archive"}
        destructive
        pending={archiving}
        onCancel={() => setConfirmArchive(false)}
        onConfirm={doArchive}
      />
    )}
    </>
  );
}
