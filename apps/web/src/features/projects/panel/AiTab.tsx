import { useState } from "react";

import { SparkleIcon } from "./icons";
import { ProFeatureModal } from "./ProFeatureModal";
import { UpgradeToProModal } from "./UpgradeToProModal";

const CHECKS = [
  "Reads every comment on this page",
  "Prioritises issues by severity",
  "Summarises page progress at a glance",
];

// Static shell only - subscription/billing functionality is coming later, so
// "Analyse Page" always leads to the paywall rather than doing anything real.
export function AiTab() {
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPricing, setShowPricing] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="from-accent-primary flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br to-fuchsia-400 text-white">
        <SparkleIcon width={26} height={26} stroke="none" fill="currentColor" />
      </span>
      <h3 className="text-lg font-semibold">Welcome to BugHunt AI</h3>
      <ul className="flex flex-col gap-3 self-stretch text-left">
        {CHECKS.map((check) => (
          <li key={check} className="flex items-start gap-2.5 text-sm">
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              className="text-status-resolved mt-0.5 shrink-0"
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M6 10.5 8.8 13 14 7.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {check}
          </li>
        ))}
      </ul>
      <button
        onClick={() => setShowPaywall(true)}
        className="from-accent-primary w-full rounded-lg bg-gradient-to-r to-fuchsia-500 py-2.5 text-sm font-semibold text-white"
      >
        Analyse Page
      </button>

      {showPaywall && (
        <ProFeatureModal
          description="Get AI-powered comment summaries, priority overviews, and actionable insights. Upgrade to Pro to analyse your pages and projects with BugHunt AI."
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
