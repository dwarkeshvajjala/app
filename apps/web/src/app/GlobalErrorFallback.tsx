import type { FallbackRender } from "@sentry/react";

export const GlobalErrorFallback: FallbackRender = ({ error, resetError }) => {
  return (
    <div className="bg-bg-canvas flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <div className="border-recovery-orphaned bg-recovery-orphaned/10 max-w-lg rounded-xl border p-8">
        <h1 className="mb-4 text-2xl font-bold text-red-500 dark:text-red-400">
          Something went wrong
        </h1>
        <p className="text-text-muted mb-6 text-sm">
          An unexpected error occurred. Our team has been notified.
        </p>
        <div className="bg-bg-surface text-text-primary mb-6 overflow-auto rounded-md p-4 text-left font-mono text-xs shadow-inner">
          {error instanceof Error ? error.message : String(error)}
        </div>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => window.location.assign("/")}
            className="border-black/10 text-text-primary hover:bg-bg-surface rounded-md border px-4 py-2 text-sm font-semibold transition-colors dark:border-white/10"
          >
            Go to Home
          </button>
          <button
            onClick={resetError}
            className="bg-accent-primary hover:bg-accent-primary/90 rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};
