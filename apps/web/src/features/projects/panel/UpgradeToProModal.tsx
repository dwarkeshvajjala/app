import { Dialog } from "../../../components/Dialog";

// Billing placeholder only. Prices, entitlements, checkout, invoices, and webhooks do
// not exist yet, so this modal deliberately contains no simulated plan calculator.
export function UpgradeToProModal({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Plans and billing are coming soon" onClose={onClose}>
      <div className="bl-form" style={{ alignItems: "center", textAlign: "center" }}>
        <span className="bl-scope-badge">Coming soon</span>
        <p>
          Backline does not currently have configured prices, paid entitlements, or a checkout provider.
          Nothing on this screen can charge you or change workspace limits.
        </p>
        <button type="button" onClick={onClose} className="bl-button mint" style={{ width: "100%" }}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}
