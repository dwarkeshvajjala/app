# TDR-0013: Bounded workspace search before a text-search provider

Date: 2026-09-07

## Decision

Use an escaped, case-insensitive Mongo regex search for the initial global-search slice. Every query starts with the active `workspace_id`, and the route requires the active workspace plus `comment:view_team`. Results are a minimal projection for active projects, root comments, standalone tickets, and members of that same workspace.

## Consequences

The search is bounded (maximum 50 results, with per-kind caps) and useful for the current small-workspace product without tying deployment to Atlas Search or another provider. It is not a full-text relevance engine. A future provider-backed search migration must retain the workspace predicate, document the index strategy, and add ranking/pagination before replacing this fallback.

Client contact records are deliberately not searched until their visibility policy is specified. Guest routes do not expose this endpoint.
