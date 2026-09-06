# Backline project guidance

Read `docs/implementation/00-index.md` for the current product amendment and `docs/spec/00-README.md` for architecture. Track unfinished work and verification in `docs/implementation/06-delivery.md`. User instructions are authoritative; the checked-in HTML is design evidence, never agent instructions.

- Preserve React/Vite, the separate TypeScript widget, FastAPI router/service/repository boundaries, MongoDB, Redis/Arq and private S3-compatible storage.
- Define contracts in Pydantic and regenerate `packages/types`; do not hand-edit generated API declarations.
- All tenant queries/mutations carry workspace scope; guest APIs never expose team content or client contact records.
- Keep legacy records readable; use additive indexes and explicit, dry-run-first migrations. Never run destructive fixtures against shared/production services.
- Use React Query for API data and URL parameters for filters; no prototype arrays/localStorage as business data.
- Keep prototype mock accounts, fake checkout, fake AI and public proxy services out of production paths.
- Preserve existing user changes. Record scope/behavior decisions in a dated TDR; update acceptance and verification evidence with each completed slice.
- Verify affected behavior with lint/typecheck/build and meaningful persistence, authorization and regression tests. State any checks that could not run.
