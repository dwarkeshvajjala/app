import { Dialog } from "../../components/Dialog";

interface ComingSoonModalProps {
  feature: string;
  onClose: () => void;
}

// Distinct from ProFeatureModal (features/projects/panel/ProFeatureModal.tsx): that one
// gates a built feature behind a plan upgrade - paying would actually unlock it. This
// gates something that isn't built at all yet (a second project type, an MCP
// integration), so it deliberately has no "Upgrade to Pro" CTA - that would imply
// paying gets you the feature, which wouldn't be true.
export function ComingSoonModal({ feature, onClose }: ComingSoonModalProps) {
  return (
    <Dialog title="Coming soon" onClose={onClose}>
      <div className="bl-form" style={{ alignItems: "center", textAlign: "center" }}>
        <span className="bl-scope-badge">Coming soon</span>
        <p><strong>{feature} isn't available yet.</strong> Website review is the only project type live today - {feature} is on the roadmap and we'll let you know when it ships.</p>
        <button type="button" onClick={onClose} className="bl-button mint" style={{ width: "100%" }}>
          Got it
        </button>
      </div>
    </Dialog>
  );
}
