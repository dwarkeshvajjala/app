# 17 - Notifications & Integrations

## 17.1 Generic Integration Interface

All integrations implement one interface so adding Jira/GitHub later (`03-System-Architecture.md` §3.6) is a new class, not a new subsystem:

```python
class Integration(Protocol):
    async def on_comment_created(self, comment: Comment, config: dict) -> None: ...
    async def on_status_changed(self, comment: Comment, config: dict) -> None: ...
    async def test_connection(self, config: dict) -> bool: ...
```
Each concrete integration (`SlackIntegration`, `ClickUpIntegration`, `TrelloIntegration`) lives in `backend/app/modules/integrations/<name>.py`, registered in a small factory keyed by `integrations.type` (`11-Database.md` §11.12). Dispatch always goes through the Arq job queue (`06-Backend-Architecture.md` §6.5) - never inline in the request path.

## 17.2 Slack

- Setup: agency pastes an Incoming Webhook URL (simplest possible connection - no OAuth app review needed for MVP).
- Events sent: `comment.created`, `comment.status_changed` (configurable per integration - a toggle for which event types post).
- Message format: comment body (truncated), page URL, layer badge (team-only comments **never** post to a shared Slack channel unless the admin explicitly configures a private channel - this is called out plainly in the connect-flow UI, since Slack channels are easy to accidentally make more visible than intended).

## 17.3 ClickUp (First Deep Integration)

- OAuth2 connect flow; token stored encrypted (`config_json.oauth_token_encrypted`, encrypted at the application layer before it ever reaches Mongo - Rule 6).
- "Create task from comment" (manual, member-triggered: `POST /comments/{id}/integrations/clickup/create-task`) creates a ClickUp task with: comment body as description, screenshot attached, metadata (browser/OS/page URL) in a structured description block, and a deep link back to the comment's pin in Backline.
- Round-trip requirement (`01-Product-Vision.md` §1.10): the created task must preserve screenshot + metadata + backlink on 100% of attempts - tested explicitly in `19-Testing-CI.md`'s integration suite, not just happy-pathed manually.

## 17.4 Trello (Second Integration)

Same `Integration` interface, same manual "create card from comment" trigger; card description mirrors the ClickUp task's structured block. No auto-sync of status changes back from Trello in MVP (one-directional: Backline -> Trello only).

## 17.5 Asana

Architected via the same interface (config shape: workspace GID + project GID), but **not implemented in MVP** - this is the placeholder proving the interface generalizes past ClickUp/Trello without changes; implementation is a v-next task, not a redesign.

## 17.6 Email Notifications

- **Instant or daily digest** (member-configurable per workspace, default: daily), sent via Resend using React Email templates.
- Digest content: new comments since last digest, grouped by project/page, respecting the recipient's own visibility (an agency member who's also restricted from certain projects - v-next multi-project permission granularity - would only see what they can access; in MVP all members see all workspace projects, so this is a forward-compatible grouping choice, not a current restriction).
- **Guest notification**: optional - a guest reviewer can supply an email at session creation to receive a "your feedback was addressed" notification when a comment they authored moves to `resolved`. Opt-in, never required (F1: "no email required to comment").

## 17.7 Webhook Retry Engine

Applies to Slack webhook delivery and any future outbound webhook feature:
- Exponential backoff: 3 retries at 5s / 30s / 5min, then dead-letter (logged to `events` as `webhook.delivery_failed`, surfaced in the Activity feed so an admin notices a broken Slack webhook rather than silently losing notifications).
- Idempotency: each outbound delivery carries a stable `event_id` so a retried delivery that actually succeeded-but-timed-out doesn't double-post on the receiving end (Slack/ClickUp both tolerate this via their own idempotency where supported; documented per-integration where it isn't).

## 17.8 In-App Notification Center

Backed by a `notifications` collection (per-member, generated server-side when relevant events fire - comment assigned to you, mentioned in a reply, integration disconnected unexpectedly). Delivered via the `notification.new` WebSocket event (`12-API-WebSocket.md` §12.6) plus a paginated `GET /notifications` for the bell-icon dropdown history.
