# TDR-0007: Recovery Pipeline (M8) - design decisions and known limitations

Date: 2026-07-12
Status: Accepted

## Decision: the Diff Engine doesn't drive the recovery decision

`10-Revision-Recovery.md` §10.4 reads as if the Recovery Engine consults the Diff
Engine's classification (unchanged/moved/modified/removed) to decide how to recover
each comment. In practice, `modules/anchor_engine/matcher.py`'s `match_anchor()`
(Milestone 5) is a full, independent tiered scan of the *entire* new snapshot's
`nodes_index` - it doesn't need to know whether a node was "moved" or "modified" ahead
of time, it re-derives the right answer per anchor from scratch (exact path -> stable
attribute -> content hash -> text-similarity). Building a second classification step
that `run_recovery_pipeline` consults instead would either (a) duplicate `match_anchor`'s
own logic in a second place, guaranteed to drift over time, or (b) be pure overhead that
changes nothing about the outcome.

So: `modules/revision_engine/diff.py`'s `compute_diff()` is real and runs on every new
revision (persisted to `revision_diffs` per `11-Database.md` §11.9), but it's an
independent, structural artifact for audit/"what changed" purposes (§10.3's own stated
use) - not an input to `match_anchor`. Per-comment recovery always calls `match_anchor`
directly against the new revision's full `nodes_index`, regardless of what the diff
classified that node as. Both computations run on the same two snapshots and are
individually tested (`tests/test_revision_engine.py` for the diff, `tests/test_anchor_engine.py`
for the matcher, `tests/test_recovery_engine.py` for the orchestration end-to-end) - they
just don't feed into each other.

## Decision: re-anchoring can't fully reconstruct `selector_path`

A snapshot's `nodes_index` (09-Snapshot-Engine.md §9.6) carries `node_hash`,
`ancestor_path_hash`, `tag`, `attributes`, `text` - everything `match_anchor` needs. It
does **not** carry a CSS `selector_path` - that's only ever computed live, client-side,
by the widget's `anchor.ts` at the moment someone drops a pin. When the recovery
pipeline re-anchors a comment to a new node, it refreshes `node_hash`,
`ancestor_path_hash`, `tag`, and `attributes` from the matched node, but leaves
`dom_fingerprint.selector_path` as whatever it was before - stale, not invented.

This is inert for correctness: `match_anchor` never reads `selector_path` at all (see
`matcher.py` - only `attributes`, `node_hash`, `ancestor_path_hash`, and the text
fingerprint are consulted). It would only matter for a hypothetical future feature that
uses `selector_path` to, say, scroll a live page to the comment's element for debugging -
nothing in any milestone so far does that. Flagged here so it isn't mistaken for a bug
later.

## Decision: `permanently_orphaned` stops automatic retries entirely

§10.5 says a comment is "re-attempted on every subsequent Revision" until two
consecutive misses, then marked `permanently_orphaned`. It's silent on what happens
after that. Implemented here: `CommentRepository.list_recoverable_for_page()` excludes
`permanently_orphaned` comments outright - the pipeline never looks at them again, even
if the original element reappears verbatim on a later revision (a reverted deploy,
tested in `test_permanently_orphaned_comment_is_no_longer_retried`). Recovery resumes
only via a human's `PATCH /comments/{id}/reanchor`, which already resets
`consecutive_orphaned_revisions` to 0. This matches P4 (Human First)'s "never wonder if
the system is still looking" - once given up, it should say so and stay said, not
silently start trying again on its own schedule.

## Arq wiring specifics

- `app/core/arq_pool.py` mirrors `core/redis_client.py`'s lazy-singleton pattern for the
  *enqueuing* connection (request-handling code only ever publishes, never consumes).
- `app/workers/recovery.py` is a thin wrapper - `WorkerSettings` and the job function
  registration live there and nowhere else; the actual logic
  (`modules/recovery_engine/service.py`'s `run_recovery_pipeline`) is a plain,
  directly-callable async function with no Arq-specific types in its signature, so it's
  testable without a running worker (`tests/test_recovery_engine.py` calls it directly)
  and so the worker file stays a one-page adapter.
- `submit_snapshot` only enqueues when a previous revision existed (`current is not
  None`) - a page's first-ever snapshot has nothing to recover against, so there's no
  reason to queue a guaranteed no-op.
- Run the worker locally with `uv run arq app.workers.recovery.WorkerSettings` alongside
  the API server; see the updated README "Running everything" section.
- Tests enqueue real jobs into the real local Redis (there's no separate test queue) -
  `tests/conftest.py`'s `db` fixture now clears `arq:*` keys before and after each test,
  the same way it already cleared `rate-limit:*`, so test runs don't leave permanent
  litter (or confusing "page no longer exists" log lines) for anyone running the worker
  locally without also running the tests.

## Verification

Golden dataset scenarios (19-Testing-CI.md §19.2) are covered end-to-end through real DB
state in `tests/test_recovery_engine.py` - not just at the matcher level (already done in
M5) but through the full orchestration: two snapshot submissions, a comment anchored to
the first, `run_recovery_pipeline` called directly (the same function the Arq worker
calls), asserting the comment's `recovery_status`, rewritten anchor, and `recovery_logs`
entry. Real end-to-end proof (Journey #4, §19.3) was done twice against the live dev
stack with an actual Arq worker process consuming the actual Redis queue: a standalone
script driving a live WebSocket connection that received `comment.recovery_updated`
after an out-of-band "redeploy," and a real Playwright/Chromium session watching the
dashboard Board's `RecoveryBadge` change from nothing to "Anchor uncertain" live, with
zero manual refresh, while the redeploy happened entirely out-of-band.
