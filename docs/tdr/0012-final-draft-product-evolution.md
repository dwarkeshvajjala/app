# TDR-0012: Final Draft product evolution

Date: 2026-09-06
Status: Accepted

## Context

The supplied Final Draft HTML expands the website-review product with client management, workspace tickets, richer workflow metadata, asset reviews and a new visual language. Its runtime is an in-memory demo with simulated provider/security behavior. The user requests an indexed plan followed by implementation, retaining the current architecture.

## Decision

Adopt the [Final Draft PRD and flow matrix](../implementation/00-index.md) as a dated amendment to specs 01–20. Keep React/Vite, FastAPI/Motor/MongoDB, Redis/Arq, private object storage, generated OpenAPI types and the separate review SDK. Extend comments rather than creating duplicate ticket records. Retain prior status values and API compatibility fields. Deliver additive database changes with scoped queries and tests. Existing authentication and security enforcement take precedence over simulated prototype behavior. Provider-dependent features are not complete until genuinely integrated.

## Consequences

The old M0–M12 completion report is historical and does not establish Final Draft parity. [The delivery ledger](../implementation/06-delivery.md) is the current evidence source. Historical TDRs remain intact. No paid provider, external message, production deploy or data reset is implied by implementation work.
