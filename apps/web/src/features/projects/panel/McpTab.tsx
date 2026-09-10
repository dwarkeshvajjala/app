import { useToast } from "../../../components/Toast";

const CONNECTORS = [
  { name: "Claude", color: "#D97757" },
  { name: "Cursor", color: "var(--brand-cursor, #14141A)" },
  { name: "Codex", color: "#10A37F" },
  { name: "Antigravity", color: "#4F46E5" },
];

// Static shell only - no real MCP server exists yet (Connect intentionally does
// nothing beyond a toast). Matches this tab's own stated scope: wired up later.
export function McpTab() {
  const { toast } = useToast();
  return (
    <div className="flex flex-col gap-5 p-4">
      <p style={{ color: "var(--ink-3)", fontSize: 13 }}>
        Let your AI agent read comments, push fixes, and close threads - without switching
        tabs.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Connect</h3>
        <div className="flex flex-col gap-2">
          {CONNECTORS.map((connector) => (
            <div key={connector.name} className="bl-connector-row">
              <span className="bl-connector-name">
                <span className="bl-connector-id" style={{ background: connector.color }}>
                  {connector.name[0]}
                </span>
                {connector.name}
              </span>
              <button
                type="button"
                onClick={() => toast(`Connecting ${connector.name} is coming soon.`, "warning")}
                className="bl-quiet"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => toast("Adding other MCP clients is coming soon.", "warning")}
          className="bl-quiet"
          style={{ marginTop: 8, width: "100%" }}
        >
          + Add other MCP
        </button>
      </div>

      <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
        <h3 className="text-sm font-semibold">Personal access token</h3>
        <p className="bl-inline-note" style={{ marginTop: 6 }}>
          Coming soon.
        </p>
      </div>
    </div>
  );
}
