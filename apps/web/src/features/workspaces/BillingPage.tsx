import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { UpgradeToProModal } from "../projects/panel/UpgradeToProModal";
import type { WorkspaceOut } from "./api";

const FREE_PLAN_FEATURES = [
  "5 Users",
  "5 pages per project",
  "All Project Types",
  "1 Project",
  "Unlimited Guests",
  "All Integrations",
];

// workspace.plan is a real field (backend/app/modules/workspaces/repository.py defaults
// every new workspace to "free"), just not enforced against anything yet - no code path
// checks it before letting a workspace add another project or member. This page reads
// it honestly rather than hardcoding "Free", but the feature list below and the
// Upgrade flow are the same static shell as every other pro-gated surface in this pass.
export function BillingPage() {
  const { workspace } = useOutletContext<{ workspace: WorkspaceOut }>();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const planLabel = workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1);

  return (
    <main className="px-6 py-8">
      <h1 className="text-xl font-semibold">Billing</h1>

      <div className="mt-6 max-w-lg overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
        <div className="p-6">
          <p className="text-text-muted text-sm font-medium">Your Plan</p>
          <p className="mt-1 text-3xl font-bold">{planLabel}</p>
          <p className="text-text-muted mt-4 text-sm font-medium">Your plan includes:</p>
          <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
            {FREE_PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-current" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-bg-canvas flex justify-end border-t border-black/10 px-6 py-3 dark:border-white/10">
          <button
            onClick={() => setShowUpgrade(true)}
            className="from-accent-primary rounded-lg bg-gradient-to-r to-fuchsia-500 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Upgrade
          </button>
        </div>
      </div>

      {showUpgrade && <UpgradeToProModal onClose={() => setShowUpgrade(false)} />}
    </main>
  );
}
