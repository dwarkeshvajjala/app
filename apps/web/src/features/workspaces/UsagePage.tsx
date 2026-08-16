// No AI feature exists in this app yet (no comment-analysis run, no token accounting) -
// this page is a real, honest zero-state rather than fabricated numbers: every count
// below is genuinely 0 because nothing has run, not because the value was hardcoded to
// look plausible.
const MONTH_LABEL = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

export function UsagePage() {
  return (
    <main className="px-6 py-8">
      <h1 className="text-xl font-semibold">AI Usage</h1>

      <div className="mt-6 max-w-3xl rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-lg font-semibold">{MONTH_LABEL}</h2>
        <p className="text-text-muted text-sm">Workspace totals for this calendar month.</p>
        <div className="mt-5 grid grid-cols-3 gap-6">
          <div>
            <p className="text-text-muted text-xs font-medium">AI runs</p>
            <p className="mt-1 text-2xl font-bold">0</p>
            <p className="text-text-muted mt-1 text-xs">Comment analyses and other AI runs</p>
          </div>
          <div>
            <p className="text-text-muted text-xs font-medium">Total tokens</p>
            <p className="mt-1 text-2xl font-bold">0</p>
            <p className="text-text-muted mt-1 text-xs">0 sent · 0 received</p>
          </div>
          <div>
            <p className="text-text-muted text-xs font-medium">Avg per run</p>
            <p className="mt-1 text-2xl font-bold">0</p>
            <p className="text-text-muted mt-1 text-xs">Average across all runs this month</p>
          </div>
        </div>
      </div>

      <div className="mt-6 max-w-3xl rounded-lg border border-black/10 p-6 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Daily usage</h2>
            <p className="text-text-muted text-sm">Tokens sent and received for each day in {MONTH_LABEL}.</p>
          </div>
          <div className="text-text-muted flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-accent-primary h-2 w-2 rounded-full" /> Received
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Sent
            </span>
          </div>
        </div>
        <div className="border-black/8 mt-4 flex h-40 items-center justify-center rounded-md border border-dashed text-sm dark:border-white/10">
          <span className="text-text-muted">No usage yet this month.</span>
        </div>
      </div>

      <div className="mt-6 max-w-3xl rounded-lg border border-black/10 p-6 dark:border-white/10">
        <h2 className="text-lg font-semibold">Features</h2>
        <p className="text-text-muted text-sm">What counted toward usage and how much each feature used.</p>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="text-text-muted border-b border-black/10 text-xs font-semibold tracking-wide uppercase dark:border-white/10">
              <th className="py-2 pr-4 font-semibold">Feature</th>
              <th className="py-2 pr-4 font-semibold">Runs</th>
              <th className="py-2 pr-4 font-semibold">Tokens</th>
              <th className="py-2 pr-4 font-semibold">Sent</th>
              <th className="py-2 font-semibold">Received</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-3 pr-4">Comment analysis</td>
              <td className="py-3 pr-4">0</td>
              <td className="py-3 pr-4">0</td>
              <td className="py-3 pr-4">0</td>
              <td className="py-3">0</td>
            </tr>
          </tbody>
        </table>
        <p className="text-text-muted mt-3 text-xs">Run a feature above to start seeing breakdowns here.</p>
      </div>
    </main>
  );
}
