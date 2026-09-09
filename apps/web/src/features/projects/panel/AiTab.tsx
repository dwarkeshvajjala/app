import { SparkleIcon } from "./icons";

const CHECKS = [
  "Reads every comment on this page",
  "Prioritises issues by severity",
  "Summarises page progress at a glance",
];

// Static placeholder only. There is no AI provider, job, quota, or result-persistence
// contract yet, so this surface must not imply that payment would activate it.
export function AiTab() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <span
        style={{
          display: "flex",
          width: 56,
          height: 56,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 3,
          background: "var(--ink)",
          color: "var(--mint)",
        }}
      >
        <SparkleIcon width={26} height={26} stroke="none" fill="currentColor" />
      </span>
      <div>
        <h3 className="text-lg font-semibold">Welcome to BugHunt AI</h3>
        <span className="bl-scope-badge" style={{ marginTop: 6, display: "inline-flex" }}>
          Coming soon
        </span>
      </div>
      <ul className="flex flex-col gap-3 self-stretch text-left">
        {CHECKS.map((check) => (
          <li key={check} className="flex items-start gap-2.5 text-sm">
            <svg
              viewBox="0 0 20 20"
              width="18"
              height="18"
              fill="none"
              className="mt-0.5 shrink-0"
              style={{ color: "var(--mint-deep)" }}
              aria-hidden="true"
            >
              <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M6 10.5 8.8 13 14 7.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {check}
          </li>
        ))}
      </ul>
      <p className="bl-inline-note">
        Analysis is not available yet. No comments are sent to an AI provider and no usage is recorded.
      </p>
      <button type="button" disabled className="bl-button mint" style={{ width: "100%" }}>
        Analysis coming soon
      </button>
    </div>
  );
}
