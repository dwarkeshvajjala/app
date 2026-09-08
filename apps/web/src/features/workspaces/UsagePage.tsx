// No AI feature exists in this app yet (no comment-analysis run, no token accounting) -
// this page is a real, honest zero-state rather than fabricated numbers: every count
// below is genuinely 0 because nothing has run, not because the value was hardcoded to
// look plausible.
const MONTH_LABEL = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

export function UsagePage() {
  return (
    <main className="bl-wrap">
      <header className="bl-head">
        <div>
          <h1>AI Usage</h1>
          <p>Workspace totals for this calendar month.</p>
        </div>
      </header>

      <section className="bl-attention" style={{ display: "flex", gap: "40px" }}>
        <header style={{ flex: "0 0 200px" }}>
          <h2>{MONTH_LABEL}</h2>
        </header>
        <div style={{ flex: 1, padding: "20px", display: "flex", gap: "40px" }}>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 500 }}>AI runs</p>
            <p style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0" }}>0</p>
            <p className="bl-mono">Comment analyses</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 500 }}>Total tokens</p>
            <p style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0" }}>0</p>
            <p className="bl-mono">0 sent &middot; 0 received</p>
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 500 }}>Avg per run</p>
            <p style={{ fontSize: "24px", fontWeight: 700, margin: "4px 0" }}>0</p>
            <p className="bl-mono">Average across all runs</p>
          </div>
        </div>
      </section>

      <section className="bl-attention" style={{ display: "flex", gap: "40px" }}>
        <header style={{ flex: "0 0 200px" }}>
          <h2>Daily usage</h2>
        </header>
        <div style={{ flex: 1, padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p className="bl-mono">Tokens sent and received for each day.</p>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "10px", color: "var(--bl-muted)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--bl-mint)" }} /> Received
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--amber)" }} /> Sent
              </span>
            </div>
          </div>
          <div style={{ height: "120px", display: "grid", placeItems: "center", border: "1px dashed var(--bl-line)", borderRadius: "3px" }}>
            <span className="bl-mono">No usage yet this month.</span>
          </div>
        </div>
      </section>

      <section className="bl-attention" style={{ display: "flex", gap: "40px" }}>
        <header style={{ flex: "0 0 200px" }}>
          <h2>Features</h2>
        </header>
        <div style={{ flex: 1, padding: "20px" }}>
          <table className="bl-table" style={{ border: "1px solid var(--bl-line)" }}>
            <thead>
              <tr>
                <th>Feature</th>
                <th>Runs</th>
                <th>Tokens</th>
                <th>Sent</th>
                <th>Received</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Comment analysis</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
                <td>0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
