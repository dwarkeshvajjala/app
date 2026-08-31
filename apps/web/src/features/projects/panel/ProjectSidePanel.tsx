import { useState } from "react";
import type { RefObject } from "react";

import type { ProjectOut } from "../api";
import { AiTab } from "./AiTab";
import { CommentsTab } from "./CommentsTab";
import { DetailsTab } from "./DetailsTab";
import {
  CommentsIcon,
  DetailsIcon,
  IntegrationsIcon,
  McpIcon,
  SparkleIcon,
} from "./icons";
import { IntegrationsTab } from "./IntegrationsTab";
import { McpTab } from "./McpTab";

type TabId = "details" | "comments" | "mcp" | "integrations" | "ai";

const TABS: { id: TabId; label: string; icon: typeof DetailsIcon }[] = [
  { id: "details", label: "Details", icon: DetailsIcon },
  { id: "comments", label: "Comments", icon: CommentsIcon },
  { id: "mcp", label: "MCP", icon: McpIcon },
  { id: "integrations", label: "Integrations", icon: IntegrationsIcon },
];

const TAB_TITLES: Record<TabId, string> = {
  details: "About this page",
  comments: "Comments",
  mcp: "MCP Server",
  integrations: "Integrations",
  ai: "BugHunt AI",
};

interface ProjectSidePanelProps {
  project: ProjectOut;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  canvasRef: RefObject<HTMLIFrameElement | null>;
  currentPageId: string | null;
}

// Collapsed by default (just the icon rail) - clicking a tab opens its panel; clicking
// the already-open tab again, or its own close button, collapses it back. Only one tab
// panel is ever open at a time, matching the reference this was modeled on.
export function ProjectSidePanel({
  project,
  workspaceId,
  workspaceSlug,
  workspaceName,
  canvasRef,
  currentPageId,
}: ProjectSidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId | null>(null);

  function toggleTab(id: TabId) {
    setActiveTab((current) => (current === id ? null : id));
  }

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex h-full">
      {activeTab && (
        <div className="bg-bg-canvas flex w-full sm:w-[380px] flex-col border-l border-black/10 shadow-xl dark:border-white/10">
          <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
            <h2 className="text-sm font-semibold">{TAB_TITLES[activeTab]}</h2>
            <button
              onClick={() => setActiveTab(null)}
              aria-label="Close panel"
              className="text-text-muted hover:text-text-primary text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {activeTab === "details" && (
              <DetailsTab
                project={project}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                workspaceName={workspaceName}
              />
            )}
            {activeTab === "comments" && (
              <CommentsTab
                projectId={project.id}
                canvasRef={canvasRef}
                currentPageId={currentPageId}
              />
            )}
            {activeTab === "mcp" && <McpTab />}
            {activeTab === "integrations" && <IntegrationsTab />}
            {activeTab === "ai" && <AiTab />}
          </div>
        </div>
      )}

      <div className="flex w-14 shrink-0 flex-col items-center gap-2 border-l border-black/10 bg-white py-3 dark:border-white/10 dark:bg-[#14141A]">
        {TABS.map(({ id, label, icon: TabIcon }) => (
          <button
            key={id}
            onClick={() => toggleTab(id)}
            aria-pressed={activeTab === id}
            aria-label={label}
            className={`flex h-24 w-11 flex-col items-center justify-center gap-2 rounded-lg border text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 ${
              activeTab === id
                ? "border-accent-primary text-accent-primary"
                : "border-black/10 text-text-muted hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
            }`}
          >
            <TabIcon />
            <span
              className="tracking-wide"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              {label}
            </span>
          </button>
        ))}

        <button
          onClick={() => toggleTab("ai")}
          aria-pressed={activeTab === "ai"}
          aria-label="BugHunt AI"
          className={`mt-auto flex h-28 w-11 flex-col items-center justify-center gap-2 rounded-lg border px-1 py-2 text-xs font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 ${
            activeTab === "ai" ? "border-accent-primary" : "border-black/10 dark:border-white/10"
          }`}
        >
          <span className="from-accent-primary flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br to-fuchsia-400 text-white">
            <SparkleIcon width={13} height={13} stroke="none" fill="currentColor" />
          </span>
          <span
            className="leading-none tracking-wide"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            BugHunt <span className="text-accent-primary">ai</span>
          </span>
        </button>
      </div>
    </div>
  );
}
