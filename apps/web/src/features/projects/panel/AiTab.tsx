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
      <span
        style={{
          display: "flex",
          width: 56,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 3,
          background: "var(--ink)",
          color: "var(--mint)",
        }}
      >
        <SparkleIcon width={26} height={26} stroke="none" fill="currentColor" />
      </span>
      <div>
        <h3 className="text-lg font-semibold">Welcome to BugHunt AI</h3>
        <span className="bl-scope-badge" style={{ marginTop: 6, display: "inline-flex" }}>
          Pro feature
        </span>
      </div>
      <ul className="flex flex-col gap-3 self-stretch text-left">
        {CHECKS.map((check) => (
          <li key={check} className="flex items-start gap-2.5 text-sm">
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              className="mt-0.5 shrink-0"
              style={{ color: "var(--mint-deep)" }}
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
      <button type="button" onClick={() => setShowPaywall(true)} className="bl-button mint" style={{ width: "100%" }}>
        Analyse page
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
