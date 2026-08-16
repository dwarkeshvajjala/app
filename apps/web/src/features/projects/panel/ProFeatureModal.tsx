interface ProFeatureModalProps {
  description: string;
  onClose: () => void;
  onUpgrade: () => void;
}

// The small "you just explored a pro feature" teaser - shared by every pro-gated
// trigger point (multi-version, page approval, private mode, BugHunt AI's own
// Analyse Page) rather than duplicated per trigger. Subscription functionality
// itself is coming later, so "Upgrade to Pro" here just opens the full pricing modal
// (UpgradeToProModal) - nothing purchasable actually happens yet.
export function ProFeatureModal({ description, onClose, onUpgrade }: ProFeatureModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="This is a Pro feature"
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex w-full max-w-sm flex-col items-center gap-4 rounded-xl p-6 text-center dark:bg-[#14141A]"
      >
        <span className="bg-accent-primary/10 text-accent-primary rounded-full px-3 py-1 text-xs font-semibold">
          Pro Feature
        </span>
        <h3 className="text-lg font-semibold">You just explored a pro feature</h3>
        <p className="text-text-muted text-sm">{description}</p>
        <button
          onClick={onUpgrade}
          className="from-accent-primary w-full rounded-lg bg-gradient-to-r to-fuchsia-500 py-2.5 text-sm font-semibold text-white"
        >
          Upgrade to Pro
        </button>
        <button onClick={onClose} className="bg-bg-canvas w-full rounded-lg py-2.5 text-sm font-medium">
          Continue using BugHunt for free
        </button>
      </div>
    </div>
  );
}
