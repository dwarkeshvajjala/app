import type { ReactNode } from "react";

// Comments have no separate "mentions" array from the API - MentionsInput writes
// "@Full Name " straight into the stored body at compose time (see its own comment
// on why: names aren't a stable identity, the mentioned member id is sent to the
// server as `mentioned_user_ids` instead). Rendering is therefore a display-only
// regex highlight over the plain text, not a lookup - good enough to make a mention
// visually distinct without claiming it links anywhere.
const MENTION_RE = /@[^\s@]+(?:\s[A-Z][^\s@]*)?/g;

export function renderWithMentions(body: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const index = match.index ?? 0;
    if (index > lastIndex) nodes.push(body.slice(lastIndex, index));
    nodes.push(
      <span className="bl-mention" key={key++}>
        {match[0]}
      </span>,
    );
    lastIndex = index + match[0].length;
  }
  if (lastIndex < body.length) nodes.push(body.slice(lastIndex));
  return nodes;
}
