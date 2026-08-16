import { useEffect, useRef, useState } from "react";

import { timeAgo } from "../../../lib/time";
import { ChevronIcon } from "../panel/icons";
import { ProFeatureModal } from "../panel/ProFeatureModal";
import { UpgradeToProModal } from "../panel/UpgradeToProModal";

interface VersionMenuProps {
  totalComments: number;
  createdAt: string;
}

// Real multi-version tracking isn't built yet (this project only ever has the one,
// current live page) - "+ Add new version" walks through the same confirm-then-paywall
// flow the reference does, ending at the shared pro-feature teaser rather than
// actually creating anything.
export function VersionMenu({ totalComments, createdAt }: VersionMenuProps) {
  const [open, setOpen] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [open]);

  function handleCopyChoice() {
    setShowCopyConfirm(false);
    setShowPaywall(true);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium dark:border-white/10"
      >
        Version 1
        <ChevronIcon width={12} height={12} className={open ? "rotate-180" : ""} />
      </button>

      {open && (
        <div className="bg-bg-surface absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-black/10 p-3 shadow-lg dark:border-white/10 dark:bg-[#14141A]">
          <div className="flex items-center justify-between">
            <span className="text-accent-primary text-sm font-semibold">Version 1</span>
            <span className="text-text-muted text-xs">{timeAgo(createdAt)}</span>
          </div>
          <p className="text-text-muted mt-0.5 text-xs">{totalComments} comments</p>
          <button
            onClick={() => {
              setOpen(false);
              setShowCopyConfirm(true);
            }}
            className="text-accent-primary mt-3 flex w-full items-center justify-center gap-1.5 border-t border-black/10 pt-3 text-sm font-medium dark:border-white/10"
          >
            + Add new version
          </button>
        </div>
      )}

      {showCopyConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowCopyConfirm(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Copy unresolved comments to new version?"
            onClick={(event) => event.stopPropagation()}
            className="bg-bg-surface flex w-full max-w-sm flex-col items-center gap-4 rounded-xl p-6 text-center dark:bg-[#14141A]"
          >
            <h3 className="text-lg font-semibold">
              Do you want to copy unresolved comments to new version?
            </h3>
            <p className="text-text-muted text-sm">
              You have some unresolved comments in your previous version. All unresolved comments
              can be copied to the new version.
            </p>
            <button
              onClick={handleCopyChoice}
              className="from-accent-primary w-full rounded-lg bg-gradient-to-r to-fuchsia-500 py-2.5 text-sm font-semibold text-white"
            >
              Yes, copy comments to new version
            </button>
            <button
              onClick={handleCopyChoice}
              className="bg-bg-canvas w-full rounded-lg py-2.5 text-sm font-medium"
            >
              No, continue without copying comments
            </button>
          </div>
        </div>
      )}

      {showPaywall && (
        <ProFeatureModal
          description="Create and manage multiple versions of your project. Upgrade to create unlimited versions, track changes, and collaborate on different iterations of your work."
          onClose={() => setShowPaywall(false)}
          onUpgrade={() => {
            setShowPaywall(false);
            setShowPricing(true);
          }}
        />
      )}
      {showPricing && <UpgradeToProModal onClose={() => setShowPricing(false)} />}
    </div>
  );
}
