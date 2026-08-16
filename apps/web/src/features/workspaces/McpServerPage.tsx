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
    <main className="px-6 py-8">
      <h1 className="text-xl font-semibold">MCP Server</h1>
      <p className="text-text-muted mt-2 max-w-2xl text-sm">
        Give your AI agent direct access to Backline feedback. Analyze comments, implement
        changes, and resolve threads without leaving your workflow.
      </p>

      <h2 className="mt-6 text-sm font-semibold">Connect</h2>
      <div className="mt-3 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {AGENTS.map((agent) => (
          <div
            key={agent.name}
            className="flex items-start justify-between gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
          >
            <div>
              <p className="text-sm font-semibold">{agent.name}</p>
              <p className="text-text-muted mt-1 text-xs">{agent.description}</p>
            </div>
            <button
              onClick={() => setComingSoon(`Connecting ${agent.name} to MCP`)}
              className="shrink-0 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
            >
              Connect
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => setComingSoon("Adding a custom MCP connection")}
        className="mt-4 rounded-md border border-black/10 px-3 py-1.5 text-xs font-medium dark:border-white/10"
      >
        + Add other MCP
      </button>

      <h2 className="mt-8 text-sm font-semibold">Personal Access Token</h2>
      <p className="text-text-muted mt-2 max-w-2xl text-sm">
        Personal access tokens aren't available yet - coming soon.
      </p>

      {comingSoon && <ComingSoonModal feature={comingSoon} onClose={() => setComingSoon(null)} />}
    </main>
  );
}
