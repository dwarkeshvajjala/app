import type { FallbackRender } from "@sentry/react";

export const GlobalErrorFallback: FallbackRender = ({ eventId, resetError }) => {
  return (
    <main className="bl-review-gate">
      <span className="bl-loading-mark" aria-hidden="true">B</span>
      <div className="bl-review-gate-copy">
        <h1>Something went wrong</h1>
        <p>An unexpected error occurred. Our team has been notified.</p>
        <div className="bl-error" role="alert">Error ID: {eventId ?? "unknown"}</div>
        <div className="bl-review-gate-actions">
          <button type="button" className="bl-quiet" onClick={() => window.location.assign("/")}>Go to Home</button>
          <button type="button" className="bl-button mint" onClick={resetError}>Try Again</button>
        </div>
      </div>
    </main>
  );
};
