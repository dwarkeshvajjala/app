import { useState } from "react";

import { ChevronIcon } from "./icons";

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
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="flex items-center justify-between text-sm font-semibold"
        style={{ color: "var(--mint-deep)" }}
      >
        <span>Available integrations ({AVAILABLE_INTEGRATIONS.length})</span>
        <span style={{ display: "inline-flex", transform: expanded ? "rotate(180deg)" : "none", transition: "transform .14s ease" }}>
          <ChevronIcon width={14} height={14} />
        </span>
      </button>
      {expanded && (
        <div className="flex flex-col gap-2">
          {AVAILABLE_INTEGRATIONS.map((integration) => (
            <div key={integration.name} className="bl-connector-row">
              <span className="bl-connector-name">
                <span className="bl-connector-id" style={{ background: integration.color }}>
                  {integration.name[0]}
                </span>
                {integration.name}
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  className="bl-switch-input"
                  checked={!!on[integration.name]}
                  onChange={() => setOn((prev) => ({ ...prev, [integration.name]: !prev[integration.name] }))}
                  aria-label={`Enable ${integration.name}`}
                />
                <span className="bl-switch" aria-hidden="true">
                  <i />
                </span>
              </label>
            </div>
          ))}
        </div>
      )}
      <p className="bl-inline-note">
        These toggles are a preview - connect a provider from the workspace Integrations settings to make it real.
      </p>
    </div>
  );
}
