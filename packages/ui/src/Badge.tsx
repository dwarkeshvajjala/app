import type { ReactNode } from "react";

export type BadgeTone =
  | "layer-client"
  | "layer-team"
  | "status-todo"
  | "status-in-progress"
  | "status-resolved"
  | "status-wont-fix"
  | "recovery-low-confidence"
  | "recovery-orphaned";

const toneClasses: Record<BadgeTone, string> = {
  "layer-client": "bg-layer-client/15 text-layer-client",
  "layer-team": "bg-layer-team/15 text-layer-team",
  "status-todo": "bg-status-todo/15 text-status-todo",
  "status-in-progress": "bg-status-in-progress/15 text-status-in-progress",
  "status-resolved": "bg-status-resolved/15 text-status-resolved",
  "status-wont-fix": "bg-status-wont-fix/15 text-status-wont-fix line-through",
  "recovery-low-confidence": "border border-recovery-low-confidence text-recovery-low-confidence",
  "recovery-orphaned": "border border-recovery-orphaned text-recovery-orphaned",
};

export interface BadgeProps {
  tone: BadgeTone;
  children: ReactNode;
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}
    >
      {children}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = `status-${status.replace(/_/g, "-")}` as BadgeTone;
  return <Badge tone={tone}>{STATUS_LABELS[status] ?? status}</Badge>;
}

// Layer distinction is a hard requirement, not a style preference: color alone fails
// colorblind users, so the lock icon + text label are mandatory alongside color,
// everywhere a layer badge renders (15-Design-System.md §15.3).
export function LayerBadge({ layer }: { layer: "client" | "team" }) {
  if (layer === "team") {
    return (
      <Badge tone="layer-team">
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="10"
          height="10"
          fill="currentColor"
        >
          <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1.5 0h5V5a2.5 2.5 0 0 0-5 0v2Z" />
        </svg>
        Team only
      </Badge>
    );
  }
  return <Badge tone="layer-client">Client visible</Badge>;
}

export function RecoveryBadge({ status }: { status: string }) {
  if (status === "ok") return null;
  if (status === "low_confidence") {
    return <Badge tone="recovery-low-confidence">Anchor uncertain</Badge>;
  }
  return <Badge tone="recovery-orphaned">Anchor lost</Badge>;
}
