# TDR-0018: Post-login UI migration contract

Date: 2026-09-08
Status: Accepted

## Context

The root `backline-Final Draft.html` is a complete interactive design reference, while
the React application contains a partially migrated dashboard and several later
feature implementations with mixed visual systems. The current request is explicitly
UI-only and asks for page-by-page delivery without waiting for unfinished backend
work.

## Decision

Adopt the Final Draft's post-login visual language as the shared product brand:
Schibsted Grotesk interface typography, JetBrains Mono operational metadata,
ink/paper/white surfaces, mint action/current-state accents, amber waiting/warning
accents, 3px geometry, fine rules, sparse depth, and restrained motion. The shared
workspace shell owns the responsive navigation drawer, global search, notifications,
account access, and global project creation. Project dashboards use deterministic,
code-native preview artwork instead of loading third-party sites in card iframes;
actual site rendering remains inside the dedicated review surface.

Migration proceeds by route family using
`docs/implementation/10-ui-migration-chat-prompts.md`. Existing APIs, authorization,
React Query ownership, and URL filters remain authoritative. Missing backend behavior
may be represented by honest static/disabled presentation, but production routes do
not gain localStorage business data, fabricated successful mutations, fake checkout,
fake AI, or public proxy dependencies.

## Consequences

The dashboard becomes visually stable even when a reviewed site blocks embedding,
mobile navigation no longer consumes the document as a horizontal rail, and global
actions remain consistent across workspace routes. Visual parity is not claimed for
later route families until their individual slices are recorded in the delivery
ledger. Automated verification for this slice is intentionally deferred at the
user's request.

