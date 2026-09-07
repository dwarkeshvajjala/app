# TDR-0017: Restore API startup with legacy comments

Date: 2026-09-07. Status: accepted.

## Incident

Railway logs show startup failing with E11000 while creating
`comments_workspace_client_request_id`: several comments in a workspace have no
request ID. The API exits before serving Google callback/refresh OPTIONS requests,
which consequently receive Railway 502 responses.

## Decision

Replace the startup definition with a unique workspace/request-ID index filtered by
`client_request_id: { $type: "string" }`. A compound sparse index includes a document
when **any** indexed field exists, including the mandatory workspace ID. It therefore
does not exclude legacy comments. This follows MongoDB's
[sparse](https://www.mongodb.com/docs/manual/core/index-sparse/) and
[partial index](https://www.mongodb.com/docs/manual/core/index-partial/) semantics.

Use the new name `comments_workspace_client_request_id_strings` so installations
where the previous sparse index succeeded do not encounter an index-options conflict.
Do not drop indexes or alter comments on startup. The failed index in the supplied
incident never finished building. If another installation retains the old sparse
index, it will still restrict missing/null request IDs; removal requires a separate,
explicitly reviewed migration, not an automatic destructive startup operation.

The new index preserves workspace-scoped idempotency and excludes missing/null IDs.
Real duplicate string IDs still fail index creation; errors are not swallowed.
No API contract, OAuth configuration, CORS policy, or frontend change is needed.

## Rollout and acceptance

`python -m scripts.migrate_comment_request_index` is a read-only index inspection;
`--apply` creates only the new index. Normal API startup creates the same index.
Deploy the backend fix, verify `/health` and both auth OPTIONS routes, then start a
fresh Google sign-in from the login page rather than reusing the old callback URL.

Regression coverage seeds missing/null IDs before the actual application lifespan,
restarts twice, checks both OPTIONS endpoints, preserves the comments, tests scoped
uniqueness, and verifies coexistence with an existing sparse index. Verification and
deployment evidence are tracked in `docs/implementation/06-delivery.md`.
