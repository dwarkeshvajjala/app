# TDR-0020: Batch 12 product and compatibility reconciliation

Date: 2026-09-09
Status: Accepted

## Context

Audit batch 12 closes M-21/M-22 documentation and product-honesty work. Earlier
documents contained four stale architecture descriptions already superseded by accepted
TDRs. Two prototype project settings also remained editable despite having no runtime
consumer, and the Final Draft's signed-in desktop gate had never received a product
decision. This record describes the real divergences; it does not relabel unwired
scaffolding as delivered.

## Decisions

1. **Keep the dashboard responsive.** The signed-in dashboard remains usable below
   1024px through its existing responsive navigation. The Final Draft's hard desktop
   gate is an intentional product divergence, not a missing feature. Guest review also
   remains responsive. This is independent of the separate Web App and Mobile App
   project types, which are still explicitly unavailable.
2. **Automatic recovery has no per-project switch.** TDR-0007 remains authoritative:
   recovery runs for every qualifying new revision. `reanchor_on_deploy` stays readable
   in the API for legacy-record compatibility but is not consulted by orchestration.
   The dashboard no longer presents it as an editable preference; it reports recovery
   as always on.
3. **Client digest is not available.** `client_digest_enabled` stays readable for
   legacy compatibility but has no recipient-verification, client-layer query,
   scheduling, or delivery contract. The dashboard no longer writes the field and
   reports the capability as unavailable. A future implementation requires a new TDR
   and a client-safe notification design.
4. **Mentions are implemented.** TDR-0009's original deferral is already explicitly
   superseded by its audit-batch-03/07 amendment. Mention IDs are validated against
   workspace membership; no additional divergence remains.
5. **AI and billing are non-functional placeholders.** Until provider, job, privacy,
   quota, entitlement, checkout, and webhook contracts exist, the UI must not fabricate
   zero usage, prices, credits, plan benefits, or a purchasable upgrade path.

## Documentation reconciliation

- TDR-0002 remains the authority for share-link authentication and UUID upload keys;
  `docs/spec/07-Review-SDK.md` now uses `shareToken`, while
  `docs/spec/18-Storage-Deployment.md` already records UUID keys.
- TDR-0005/0006 remain the authority for URL-owned filters and the narrow
  connection/presence Zustand stores; `docs/spec/14-State-Management.md` and
  `docs/spec/16-Dashboard.md` now match.
- TDR-0007 remains the authority for structural-diff/anchor-matching separation;
  `docs/spec/10-Revision-Recovery.md` now matches.

## Consequences

No database migration is needed. Existing records containing either legacy setting
remain readable. API clients can still encounter those compatibility fields, but the
first-party UI neither changes them nor promises their values affect runtime behavior.
