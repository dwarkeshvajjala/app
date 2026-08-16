import { useState } from "react";

const AVAILABLE_INTEGRATIONS = [
  { name: "Slack", color: "#4A154B" },
  { name: "Jira", color: "#0052CC" },
  { name: "Asana", color: "#F06A6A" },
  { name: "Trello", color: "#0079BF" },
  { name: "ClickUp", color: "#7B68EE" },
];

// Static shell only, matching this tab's own stated scope: real connect flows for
// Slack/Trello/ClickUp already exist elsewhere (workspace Integrations settings) -
// this quick-access panel doesn't wire into them yet, so every toggle here is
// decorative for now rather than reflecting or changing real connection state.
export function IntegrationsTab() {
  const [expanded, setExpanded] = useState(true);
  const [on, setOn] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-3 p-4">
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="text-accent-primary flex items-center justify-between text-sm font-semibold"
      >
        <span>Available Integrations ({AVAILABLE_INTEGRATIONS.length})</span>
        <span className={`transition-transform ${expanded ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {AVAILABLE_INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="border-black/8 flex items-center justify-between rounded-lg border bg-white p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-semibold text-white"
                  style={{ backgroundColor: integration.color }}
                >
                  {integration.name[0]}
                </span>
                <span className="text-sm font-medium">{integration.name}</span>
              </div>
              <button
                role="switch"
                aria-checked={!!on[integration.name]}
                aria-label={`Enable ${integration.name}`}
                onClick={() =>
                  setOn((prev) => ({ ...prev, [integration.name]: !prev[integration.name] }))
                }
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  on[integration.name] ? "bg-accent-primary" : "bg-black/15 dark:bg-white/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    on[integration.name] ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
