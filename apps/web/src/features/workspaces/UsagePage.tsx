export function UsagePage() {
  return (
    <main className="bl-wrap">
      <header className="bl-head">
        <div>
          <h1>AI Usage</h1>
          <p>AI usage tracking is not available yet.</p>
        </div>
      </header>

      <section className="bl-attention bl-settings-section">
        <header>
          <h2>Coming soon</h2>
        </header>
        <div style={{ flex: 1, padding: "20px" }}>
          <p className="bl-inline-note">
            Backline has no configured AI provider, analysis jobs, token accounting, or usage ledger.
            Metrics will appear here only after those server-side contracts exist; zero values are not fabricated in the meantime.
          </p>
        </div>
      </section>
    </main>
  );
}
