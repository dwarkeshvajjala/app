// audit-batch-13 P3: bg-status-in-progress (#F59E0B) used to be in this
// rotation - white text on it is ~2.15:1, short of WCAG AA's 4.5:1, so ~1 in 4
// avatars by name hash rendered illegibly regardless of theme. Swapped for
// bg-status-blocked (#A33D1F, ~6.5:1 with white) to keep 4 distinct hues.
const COLORS = [
  "bg-layer-team text-white",
  "bg-layer-client text-white",
  "bg-accent-primary text-white",
  "bg-status-blocked text-white",
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length]!;
}

export interface AvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: number;
}

/** A photo if we have one, otherwise the person's initial in a stable color derived
 * from their name - never a blank/anonymous circle. */
export function Avatar({ name, avatarUrl, size = 24 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.45) };

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={style}
        className="rounded-full object-cover"
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      style={style}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium ${colorFor(name)}`}
    >
      {(name.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}
