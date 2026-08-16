import { useState } from "react";

import { CollaboratorsModal } from "../panel/CollaboratorsModal";
import { CheckCircleIcon, InfoIcon, LockIcon, RocketIcon, ShareIcon } from "../panel/icons";
import { ProFeatureModal } from "../panel/ProFeatureModal";
import { UpgradeToProModal } from "../panel/UpgradeToProModal";
import type { ProjectOut } from "../api";
import { ViewportMenu, type ViewportOption } from "./ViewportMenu";
import { VersionMenu } from "./VersionMenu";

export type CanvasMode = "browse" | "comment";

interface ProjectFooterProps {
  project: ProjectOut;
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  totalComments: number;
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  viewport: ViewportOption | null;
  onViewportChange: (viewport: ViewportOption | null) => void;
}

// Mirrors the reference's bottom bar. Version history, page approval, and private
// mode are all Pro features not actually implemented yet - each just leads to the
// shared paywall (ProFeatureModal -> UpgradeToProModal) rather than doing anything
// real. Viewport switching and the Browse/Comment split are real, working controls.
export function ProjectFooter({
  project,
  workspaceId,
  workspaceSlug,
  workspaceName,
  totalComments,
  mode,
  onModeChange,
  viewport,
  onViewportChange,
}: ProjectFooterProps) {
  const [showShare, setShowShare] = useState(false);
  const [approvalPaywall, setApprovalPaywall] = useState(false);
  const [privateModePaywall, setPrivateModePaywall] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-black/10 px-3 py-2 dark:border-white/10">
      <div className="flex items-center gap-1.5">
        <VersionMenu totalComments={totalComments} createdAt={project.created_at} />
        <ViewportMenu
          viewport={viewport}
          onChange={onViewportChange}
          totalComments={totalComments}
        />
        <button
          onClick={() => setShowShare(true)}
          className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium dark:border-white/10"
        >
          <ShareIcon width={13} height={13} />
          Share
        </button>
      </div>

      <div className="bg-bg-canvas flex rounded-lg p-0.5 text-xs font-medium">
        <button
          onClick={() => onModeChange("browse")}
          aria-pressed={mode === "browse"}
          aria-label="Browse mode"
          className={`rounded-md px-3 py-1 ${
            mode === "browse"
              ? "from-accent-primary bg-gradient-to-r to-fuchsia-500 text-white"
              : "text-text-muted"
          }`}
        >
          Browse
        </button>
        <button
          onClick={() => onModeChange("comment")}
          aria-pressed={mode === "comment"}
          aria-label="Comment mode"
          className={`rounded-md px-3 py-1 ${
            mode === "comment"
              ? "from-accent-primary bg-gradient-to-r to-fuchsia-500 text-white"
              : "text-text-muted"
          }`}
        >
          Comment
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setShowPricing(true)}
          className="from-accent-primary flex items-center gap-1.5 rounded-lg bg-gradient-to-r to-fuchsia-500 px-2.5 py-1.5 text-xs font-semibold text-white"
        >
          <RocketIcon width={13} height={13} />
          Upgrade to Pro
        </button>
        <button
          onClick={() => setApprovalPaywall(true)}
          aria-label="Approve page"
          title="Approve page"
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 dark:border-white/10"
        >
          <CheckCircleIcon width={14} height={14} />
        </button>
        <button
          onClick={() => setPrivateModePaywall(true)}
          className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium dark:border-white/10"
        >
          <LockIcon width={13} height={13} />
          Private Mode
          <InfoIcon width={13} height={13} className="text-text-muted" />
          <span className="relative ml-0.5 h-3.5 w-6 shrink-0 rounded-full bg-black/15 dark:bg-white/15">
            <span className="absolute top-0.5 left-0.5 h-2.5 w-2.5 rounded-full bg-white" />
          </span>
        </button>
      </div>

      {showShare && (
        <CollaboratorsModal
          project={project}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          workspaceName={workspaceName}
          onClose={() => setShowShare(false)}
        />
      )}
      {approvalPaywall && (
        <ProFeatureModal
          description="Streamline your workflow with page approval functionality. Upgrade to mark pages as approved and prevent further changes, ensuring final versions are locked and ready for production."
          onClose={() => setApprovalPaywall(false)}
          onUpgrade={() => {
            setApprovalPaywall(false);
            setShowPricing(true);
          }}
        />
      )}
      {privateModePaywall && (
        <ProFeatureModal
          description="Keep your internal comments within your team with private mode. Upgrade to leave private comments and streamline your feedback process within your team."
          onClose={() => setPrivateModePaywall(false)}
          onUpgrade={() => {
            setPrivateModePaywall(false);
            setShowPricing(true);
          }}
        />
      )}
      {showPricing && <UpgradeToProModal onClose={() => setShowPricing(false)} />}
    </div>
  );
}
