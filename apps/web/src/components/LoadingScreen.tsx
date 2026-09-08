// A branded stand-in for the plain, unstyled "Loading..." text that used to sit
// alone in the top-left corner of an otherwise blank page while auth/workspace
// routing resolves (RequireAuth, WorkspaceLayout, ProjectLayout, and the other
// full-page gates below - each renders literally nothing else, so a left-aligned
// text node used to read as a rendering glitch rather than a loading state).
export function LoadingScreen({ label = "Loading" }: { label?: string }) {
  return (
    <div className="bl-loading-screen" role="status" aria-live="polite">
      <span className="bl-loading-mark" aria-hidden="true">B</span>
      <div className="bl-loading-bar"><i /></div>
      <div aria-hidden="true" style={{ width: "min(80vw, 480px)", display: "grid", gap: 12 }}>
        {[75, 100, 55].map((width) => <div key={width} className="bl-skeleton" style={{ height: 18, width: `${width}%`, borderRadius: 3 }} />)}
      </div>
      <p>{label}…</p>
    </div>
  );
}
