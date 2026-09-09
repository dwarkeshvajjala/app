import { useState } from "react";
import { useOutletContext } from "react-router-dom";

import { useDocumentTitle } from "../../lib/use-document-title";
import { UpgradeToProModal } from "../projects/panel/UpgradeToProModal";
import type { WorkspaceOut } from "./api";

// workspace.plan is persisted, but no billing provider or entitlement checks exist.
// This page therefore reports the stored label without inventing limits or pricing.
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
          <p>View the stored workspace plan. Billing is not connected yet.</p>
        </div>
      </header>

      <section className="bl-attention bl-settings-section">
        <header>
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
              About future plans
            </button>
          </div>
          <div style={{ paddingTop: "20px", borderTop: "1px solid var(--bl-line)" }}>
            <p className="bl-inline-note">
              Prices, checkout, invoices, and server-enforced plan limits are coming soon. No payment action is available on this page.
            </p>
          </div>
        </div>
      </section>

      {showUpgrade && <UpgradeToProModal onClose={() => setShowUpgrade(false)} />}
    </main>
  );
}
