# TDR-0002: Snippet mode uses the same share-link model as proxy mode

Date: 2026-07-12
Status: Accepted

## Context

`07-Review-SDK.md` §7.1-7.2 describes snippet mode as installed via `data-project-token="..."`
and its `Backline.init(config)` example shows `shareToken` as "present only in proxy/link
mode" - implying snippet mode identifies itself by a project-level token instead. But
`11-Database.md` §11.6 `guest_sessions` requires a non-optional `share_link_id`, and
`13-Authentication.md` §13.4's entire guest-auth flow is share-link-based (expiry, passcode,
revocation all live on `share_links`, not on `projects`). There is no schema or endpoint for a
project-level guest-auth path, and `11-Database.md` §11.5 already models `mode: "snippet" |
"proxy"` as a field *on* `share_links` - i.e., the spec's own data model already treats mode
as a property of a link, not a parallel auth system.

## Decision

There is one guest-auth model, not two: every guest session is created against a `share_link`
token, regardless of whether that link's `mode` is `"snippet"` or `"proxy"`. For snippet-mode
installs, the agency creates one long-lived, unexpiring share link (`mode: "snippet"`) and
embeds *that link's token* as `data-project-token` on the `<script>` tag - the attribute name
describes its purpose to the installing developer, but the value is a share-link token, resolved
through the exact same `/review/{token}` and `/guest-sessions` endpoints proxy-mode uses.
`Backline.init(config)` takes `{ shareToken, apiBaseUrl? }` uniformly; there is no separate
`projectToken` field or code path.

## Consequences

- No new collection or endpoint for project-level guest auth - Milestone 3's widget and
  Milestone 2's share-link/guest-session API are the same system end to end.
- `data-project-token` in a future snippet-install-instructions UI (`16-Dashboard.md` §16.1)
  should be documented to agencies as "your project's share link token," generated the same
  way any other share link is.
- If proxy-mode-specific behavior is ever needed at the API layer (not just at the injection
  layer, `03-System-Architecture.md` §3.3), it reads `share_links.mode` - no schema change
  required, since the field already exists.

## Also decided here: screenshot object key doesn't contain `comment_id`

`18-Storage-Deployment.md` §18.1 shows `screenshots/{workspace_id}/{project_id}/{comment_id}.jpg`,
but `07-Review-SDK.md` §7.4 uploads the screenshot (step 5) *before* the comment is created
(step 6) - the key cannot contain an id that doesn't exist yet. Screenshot keys are
`screenshots/{workspace_id}/{project_id}/{uuid4}.jpg`; the comment document (`11-Database.md`
§11.10) stores whatever key `POST /uploads` returned in its `screenshot_key` field, which was
never required to encode the comment's id in the first place.
