import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { useDocumentTitle } from "../../lib/use-document-title";
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
  useDocumentTitle('Billing');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const planLabel = workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1);

  return (
    <main className="bl-wrap">
      <header className="bl-head">
        <div>
          <h1>Billing</h1>
          <p>Manage your plan and features.</p>
        </div>
      </header>

      <section className="bl-attention" style={{ display: "flex", gap: "40px" }}>
        <header style={{ flex: "0 0 200px" }}>
          <h2>Your Plan</h2>
        </header>
        <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500 }}>Current Plan</p>
              <p style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0" }}>{planLabel}</p>
            </div>
            <button
              onClick={() => setShowUpgrade(true)}
              className="bl-button"
            >
              Upgrade
            </button>
          </div>
          <div style={{ paddingTop: "20px", borderTop: "1px solid var(--bl-line)" }}>
            <p style={{ fontSize: "12px", fontWeight: 500, marginBottom: "12px" }}>Your plan includes:</p>
            <ul style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", color: "var(--bl-muted)" }}>
              {FREE_PLAN_FEATURES.map((feature) => (
                <li key={feature} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "currentColor" }} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {showUpgrade && <UpgradeToProModal onClose={() => setShowUpgrade(false)} />}
    </main>
  );
}
