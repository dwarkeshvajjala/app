import { useToast } from "../../../components/Toast";

const CONNECTORS = [
  { name: "Claude", color: "#D97757" },
  { name: "Cursor", color: "#14141A" },
  { name: "Codex", color: "#10A37F" },
  { name: "Antigravity", color: "#4F46E5" },
];

// Static shell only - no real MCP server exists yet (Connect intentionally does
// nothing beyond a toast). Matches this tab's own stated scope: wired up later.
export function McpTab() {
  const { toast } = useToast();
  return (
    <div className="flex flex-col gap-5 p-4">
      <p className="text-text-muted text-sm">
        Let your AI agent read comments, push fixes, and close threads - without switching
        tabs.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Connect</h3>
        <div className="flex flex-col gap-2">
          {CONNECTORS.map((connector) => (
            <div
              key={connector.name}
              className="border-black/8 flex items-center justify-between rounded-lg border bg-white p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-white"
                  style={{ backgroundColor: connector.color }}
                >
                  {connector.name[0]}
                </span>
                <span className="text-sm font-medium">{connector.name}</span>
              </div>
              <button
                onClick={() => toast(`Connecting ${connector.name} is coming soon.`, "warning")}
                className="rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => toast("Adding other MCP clients is coming soon.", "warning")}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-black/10 py-2.5 text-sm font-medium dark:border-white/10"
        >
          + Add other MCP
        </button>
      </div>

      <div className="border-t border-black/10 pt-4 dark:border-white/10">
        <h3 className="text-sm font-semibold">Personal Access Token</h3>
        <p className="text-text-muted mt-1 text-xs">Coming soon.</p>
      </div>
    </div>
  );
}
