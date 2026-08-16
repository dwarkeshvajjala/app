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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Coming soon"
        onClick={(event) => event.stopPropagation()}
        className="bg-bg-surface flex w-full max-w-sm flex-col items-center gap-3 rounded-xl p-6 text-center dark:bg-[#14141A]"
      >
        <span className="bg-accent-primary/10 text-accent-primary rounded-full px-3 py-1 text-xs font-semibold">
          Coming soon
        </span>
        <h3 className="text-lg font-semibold">{feature} isn't available yet</h3>
        <p className="text-text-muted text-sm">
          Website review is the only project type live today. {feature} is on the roadmap
          - we'll let you know when it ships.
        </p>
        <button
          onClick={onClose}
          className="bg-bg-canvas w-full rounded-lg py-2.5 text-sm font-medium"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
