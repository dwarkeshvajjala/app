import { useState } from "react";

import { ComingSoonModal } from "./ComingSoonModal";

const AGENTS = [
  {
    name: "Claude",
    description: "Read your Backline feedback, suggest fixes, and resolve threads - all from chat.",
  },
  {
    name: "Cursor",
    description: "Analyze feedback, implement changes in your codebase, and push code without switching tabs.",
  },
  {
    name: "Codex",
    description: "Turn Backline comments into code changes and ship fixes directly from Codex.",
  },
  {
    name: "Antigravity",
    description: "Read feedback, generate implementations, and resolve threads from Antigravity.",
  },
];

// No MCP server exists in this app yet - every "Connect" button opens the same
// ComingSoonModal used for unbuilt project types, rather than pretending to start an
// OAuth flow that has nowhere to go.
export function McpServerPage() {
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  return (
    <main className="bl-wrap">
      <header className="bl-head">
        <div>
          <h1>MCP Server</h1>
          <p>
            Give your AI agent direct access to Backline feedback. Analyze comments, implement
            changes, and resolve threads without leaving your workflow.
          </p>
        </div>
      </header>

      <section className="bl-attention bl-settings-section">
        <header>
          <h2>Connect</h2>
        </header>
        <div style={{ flex: 1, padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {AGENTS.map((agent) => (
              <div
                key={agent.name}
                style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "16px", border: "1px solid var(--bl-line)", borderRadius: "3px", background: "var(--bl-surface)" }}
              >
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600 }}>{agent.name}</p>
                  <p className="bl-mono" style={{ marginTop: "4px" }}>{agent.description}</p>
                </div>
                <button
                  onClick={() => setComingSoon(`Connecting ${agent.name} to MCP`)}
                  className="bl-quiet"
                >
                  Connect
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={() => setComingSoon("Adding a custom MCP connection")}
            className="bl-quiet"
            style={{ marginTop: "16px" }}
          >
            + Add other MCP
          </button>
        </div>
      </section>

      <section className="bl-attention bl-settings-section">
        <header>
          <h2>Personal Access Token</h2>
        </header>
        <div style={{ flex: 1, padding: "20px" }}>
          <p className="bl-mono">
            Personal access tokens aren't available yet - coming soon.
          </p>
        </div>
      </section>

      {comingSoon && <ComingSoonModal feature={comingSoon} onClose={() => setComingSoon(null)} />}
    </main>
  );
}
