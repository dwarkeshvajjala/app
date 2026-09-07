import { createApiClient } from "./api-client";
import { anchorPointFor, computeAnchor, resolveAnchorElement } from "./anchor";
import { captureSnapshot } from "./dom-snapshot";
import { ensureGuestSession } from "./guest-session";
import { decodeGuestSessionId } from "./jwt";
import { trackAnchor } from "./position-tracker";
import { captureScreenshot } from "./screenshot";
import type { BacklineConfig, CommentRecord } from "./types";
import { parseUserAgent } from "./user-agent";
import {
  createShadowRoot,
  openComposer,
  openThreadView,
  promptForName,
  renderPin,
  showToast,
  showTooltip,
  type ThreadViewMessage,
} from "./ui";
import { connectReviewSocket } from "./ws-client";

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

interface RegisterPageResponse {
  id: string;
}

interface UploadResponse {
  upload_url: string;
  key: string;
}

// In proxy mode, window.location is the proxy's own URL (/proxy/{shareToken}/{realPath}),
// not the reviewed site's - fetch_proxied_resource (backend/app/modules/proxy/service.py)
// forwards `path` to the target origin verbatim, so stripping the "/proxy/{shareToken}"
// prefix and swapping in the real target_origin recovers the reviewed site's actual URL.
// In snippet mode this prefix is simply absent and the URL passes through unchanged.
// Without this, every page registered from proxy mode records a Backline-internal proxy
// URL instead of the site's own path - harmless for anchoring (which never reads it) but
// wrong for anything display-facing, like the dashboard's Comments panel grouping
// comments by page.
function realPageUrl(shareToken: string, targetOrigin: string): string {
  const prefix = `/proxy/${shareToken}`;
  let pathname = window.location.pathname;
  if (pathname.startsWith(prefix)) {
    pathname = pathname.slice(prefix.length) || "/";
  }
  const search = new URLSearchParams(window.location.search);
  search.delete("blMode");
  const qs = search.toString();
  return targetOrigin.replace(/\/+$/, "") + pathname + (qs ? `?${qs}` : "");
}

async function registerCurrentPage(
  api: ReturnType<typeof createApiClient>,
  guestToken: string,
  projectId: string,
  url: string,
): Promise<string> {
  const page = await api.request<RegisterPageResponse>("/api/v1/pages", {
    method: "POST",
    guestToken,
    body: JSON.stringify({
      project_id: projectId,
      url,
      title: document.title || null,
    }),
  });
  return page.id;
}

async function submitPageSnapshot(
  api: ReturnType<typeof createApiClient>,
  guestToken: string,
  pageId: string,
): Promise<void> {
  const snapshot = await captureSnapshot();
  await api.request(`/api/v1/pages/${pageId}/snapshots`, {
    method: "POST",
    guestToken,
    body: JSON.stringify(snapshot),
  });
}

async function uploadScreenshot(
  api: ReturnType<typeof createApiClient>,
  guestToken: string,
  projectId: string,
  blob: Blob,
): Promise<string | null> {
  try {
    const { upload_url: uploadUrl, key } = await api.request<UploadResponse>("/api/v1/uploads", {
      method: "POST",
      guestToken,
      body: JSON.stringify({ project_id: projectId, content_type: blob.type || "image/jpeg" }),
    });
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: blob,
      headers: { "Content-Type": blob.type || "image/jpeg" },
    });
    if (!putResponse.ok) return null;
    return key;
  } catch {
    return null;
  }
}

// Generic version of uploadScreenshot above, for comment/reply attachments - any
// content type in the backend's allowlist (images, PDF, Word/Excel docs, Markdown),
// not just the fixed image/jpeg a captured screenshot always is. Returns the shape
// openComposer/openThreadView's uploadFile callback expects, or null on failure (the
// caller removes the attachment's chip when this happens).
async function uploadAttachment(
  api: ReturnType<typeof createApiClient>,
  guestToken: string,
  projectId: string,
  file: File,
): Promise<{ key: string; filename: string; content_type: string } | null> {
  try {
    const contentType = file.type || "application/octet-stream";
    const { upload_url: uploadUrl, key } = await api.request<UploadResponse>("/api/v1/uploads", {
      method: "POST",
      guestToken,
      body: JSON.stringify({ project_id: projectId, content_type: contentType }),
    });
    const putResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": contentType },
    });
    if (!putResponse.ok) return null;
    return { key, filename: file.name, content_type: contentType };
  } catch {
    return null;
  }
}

async function init(config: BacklineConfig): Promise<void> {
  const api = createApiClient(config.apiBaseUrl);
  const shadow = createShadowRoot();

  // The dashboard's own canvas preview (ProjectOverviewPage) toggles between "Browse"
  // (the site behaves normally - existing pins are still visible/clickable for
  // context, but nothing invites or accepts a new comment) and "Comment" (this
  // widget's full, normal behavior) by reloading the iframe with this query param -
  // there's no other channel to reach into an already-loaded proxied page's widget
  // instance, since the widget script is baked into the proxy's HTML response
  // server-side, not passed live init() args from the parent frame.
  const commentingEnabled =
    new URLSearchParams(window.location.search).get("blMode") !== "browse";

  const guest = await ensureGuestSession(api, config.shareToken, () => promptForName(shadow));

  // We don't yet know the project - it's resolved from the share link server-side via
  // the guest token itself (every endpoint the guest calls checks their share link's
  // project, core/actor_access.py). The widget still needs it for the /uploads call's
  // request body, so it's resolved once here via the public review-resolve endpoint.
  const resolved = await api.request<{ project_id: string; target_origin: string }>(
    `/api/v1/review/${config.shareToken}`,
  );
  const projectId = resolved.project_id;

  const pageUrl = realPageUrl(config.shareToken, resolved.target_origin);
  const pageId = await registerCurrentPage(api, guest.guestSessionToken, projectId, pageUrl);
  await submitPageSnapshot(api, guest.guestSessionToken, pageId);

  // Tells the dashboard (if it's embedding this in the canvas iframe) which page is
  // currently loaded, so its Comments panel can offer "show comments on current page
  // only." "*" rather than a specific target origin: this script is served from
  // whatever proxy origin the project's share link points at, so it has no fixed,
  // known dashboard origin to address - and a page id isn't sensitive.
  window.parent.postMessage({ type: "backline:page-registered", pageId }, "*");

  // Never invites a comment that clicking wouldn't actually accept.
  const tooltip = commentingEnabled ? showTooltip(shadow) : { dismiss: () => {} };

  // The widget only ever acts as a guest (members review via the dashboard's
  // CommentThreadPanel, not this SDK) - decoding our own guest session's `sub` here is
  // just for "is this comment mine" UI gating (show/hide delete affordances). The
  // backend re-checks authorship itself on every delete/reply call regardless.
  const myGuestId = decodeGuestSessionId(guest.guestSessionToken);

  // Every top-level comment id maps to [top, ...replies] (sorted oldest-first) - the
  // full flat list the backend returns per page, regrouped here since the widget is
  // the one place that needs to render it as threads rather than a flat feed.
  const threadMessages = new Map<string, CommentRecord[]>();
  const pinsByTopId = new Map<string, { pin: HTMLElement; untrack: () => void }>();
  let openThread: { topId: string; controls: ReturnType<typeof openThreadView> } | null = null;

  // Keeps a pin glued to its target element even while the element itself moves - a
  // CSS transform/animation-driven carousel or marquee, say - independent of page
  // scroll (already handled by position:absolute + pageX/pageY, see ui.ts). `resolve`
  // returns the live element to follow; hides the pin entirely if it can't currently be
  // found (removed from the DOM, off in a part of an infinite-loop carousel that
  // doesn't exist as a real node right now) rather than leaving it at a stale position
  // that now belongs to something else.
  //
  // `offset` is added to the element's own top-left corner on every update - without
  // it, a pin created partway through a large element (e.g. clicking the middle of a
  // tall card) would visibly jump to that element's corner the instant tracking's first
  // frame fires, since getBoundingClientRect() only ever gives the corner. For a
  // brand-new pin this is the click point relative to the element, captured once at
  // click time; for one loaded from the server (no stored click offset - the backend's
  // anchor is just a selector, not a pixel), it defaults to the corner, same as before
  // this tracking existed.
  function trackPinPosition(
    pin: HTMLElement,
    resolve: () => Element | null,
    offset: { x: number; y: number } = { x: 0, y: 0 },
  ): () => void {
    return trackAnchor(resolve, (point) => {
      if (point) {
        pin.style.left = `${point.x + offset.x}px`;
        pin.style.top = `${point.y + offset.y}px`;
        pin.style.display = "";
      } else {
        pin.style.display = "none";
      }
    });
  }

  function authorLabel(comment: CommentRecord): string {
    if (comment.author_type === "guest" && comment.author_id === myGuestId) return "You";
    return comment.author_type === "member" ? "Team" : "Guest";
  }

  function canDeleteComment(comment: CommentRecord): boolean {
    return comment.author_type === "guest" && comment.author_id === myGuestId;
  }

  function buildMessages(topId: string): ThreadViewMessage[] {
    return (threadMessages.get(topId) ?? []).map((comment) => ({
      id: comment.id,
      body: comment.body,
      authorLabel: authorLabel(comment),
      createdAt: comment.created_at,
      canDelete: canDeleteComment(comment),
      attachments: comment.attachments,
    }));
  }

  function removeThreadPin(topId: string): void {
    const entry = pinsByTopId.get(topId);
    if (!entry) return;
    entry.untrack();
    entry.pin.remove();
    pinsByTopId.delete(topId);
  }

  function openThreadForComment(topId: string, x: number, y: number): void {
    // A previously-open thread never gets an "outside click" to dismiss it when this
    // is triggered from outside the iframe (the dashboard's Comments panel, via
    // postMessage below) - clicking through several comments in a row would otherwise
    // just keep stacking new .bl-thread panels on top of each other in the shadow
    // root, each with its own outside-click listener still live. Unconditional (not
    // just "a different thread") so re-triggering the same comment doesn't duplicate
    // its own panel either.
    if (openThread) {
      openThread.controls.close();
      openThread = null;
    }

    const topComment = threadMessages.get(topId)?.[0];
    const canDeleteThread = topComment ? canDeleteComment(topComment) : false;

    const controls = openThreadView(shadow, x, y, buildMessages(topId), canDeleteThread, {
      onClose: () => {
        if (openThread?.topId === topId) openThread = null;
      },
      onReply: async (body, attachments) => {
        // M-08 idempotency: one key per reply attempt (each call here is a distinct
        // logical reply, unlike the composer's one-key-per-pin case above).
        const clientRequestId = crypto.randomUUID();
        const created = await api.request<CommentRecord>(`/api/v1/comments/${topId}/replies`, {
          method: "POST",
          guestToken: guest.guestSessionToken,
          body: JSON.stringify({ body, layer: "client", attachments, client_request_id: clientRequestId }),
        });
        threadMessages.set(topId, [...(threadMessages.get(topId) ?? []), created]);
        controls.setMessages(buildMessages(topId));
      },
      onEditMessage: async (id, body) => {
        const updated = await api.request<CommentRecord>(`/api/v1/comments/${id}/body`, {
          method: "PATCH",
          guestToken: guest.guestSessionToken,
          body: JSON.stringify({ body }),
        });
        threadMessages.set(
          topId,
          (threadMessages.get(topId) ?? []).map((c) => (c.id === id ? updated : c)),
        );
        controls.setMessages(buildMessages(topId));
      },
      onDeleteMessage: async (id) => {
        await api.request(`/api/v1/comments/${id}`, {
          method: "DELETE",
          guestToken: guest.guestSessionToken,
        });
        threadMessages.set(topId, (threadMessages.get(topId) ?? []).filter((c) => c.id !== id));
        if (id === topId) {
          removeThreadPin(topId);
          controls.close();
          openThread = null;
          return;
        }
        controls.setMessages(buildMessages(topId));
      },
      onDeleteThread: async () => {
        await api.request(`/api/v1/comments/${topId}/thread`, {
          method: "DELETE",
          guestToken: guest.guestSessionToken,
        });
        threadMessages.delete(topId);
        removeThreadPin(topId);
        controls.close();
        openThread = null;
      },
    }, (file) => uploadAttachment(api, guest.guestSessionToken, projectId, file));
    openThread = { topId, controls };
  }

  function attachPinClickHandler(pin: HTMLElement, topId: string): void {
    // Registered inside the shadow root, so document's own "create a new comment"
    // click handler below never sees this click directly - Shadow DOM retargets it to
    // the shadow host first (index.ts's existing `target.closest("[data-backline-root]")`
    // check), which is what already keeps clicking a pin from also opening a fresh
    // composer, with zero extra code needed there.
    pin.addEventListener("click", (event) => {
      event.stopPropagation();
      // Read the pin's own current position rather than a coordinate captured back
      // when the pin was first created - trackPinPosition keeps it live, so this is
      // always where the pin visually is right now, moving target included.
      const x = parseFloat(pin.style.left);
      const y = parseFloat(pin.style.top);
      openThreadForComment(topId, x, y);
    });
  }

  // Existing comments on this page (guest-accessible, already server-side layer-filtered)
  // get a pin each - resolved best-effort back to a live element via the same selector
  // path captured at comment-creation time (resolveAnchorElement's own doc comment: a
  // missing match just means that pin doesn't render this load, the comment itself is
  // untouched).
  const existingComments = await api.request<CommentRecord[]>(
    `/api/v1/pages/${pageId}/comments`,
    { guestToken: guest.guestSessionToken },
  );
  const topLevelComments = existingComments.filter((c) => c.parent_id === null);
  for (const top of topLevelComments) {
    const replies = existingComments
      .filter((c) => c.parent_id === top.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    threadMessages.set(top.id, [top, ...replies]);

    const element = resolveAnchorElement(top.anchor);
    if (!element) continue;
    // Restore the click point *within* the element, not its top-left corner. A comment
    // left on one word partway through a paragraph anchors to that whole <p> (selector
    // paths resolve no finer), so rendering at the corner visibly moved the pin to the
    // start of the paragraph on every reload - the exact bug this offset fixes.
    const rect = element.getBoundingClientRect();
    const point = anchorPointFor(element, top.anchor);
    const offset = {
      x: point.x - (rect.left + window.scrollX),
      y: point.y - (rect.top + window.scrollY),
    };
    const pin = renderPin(shadow, point.x, point.y);
    attachPinClickHandler(pin, top.id);
    const untrack = trackPinPosition(pin, () => resolveAnchorElement(top.anchor), offset);
    pinsByTopId.set(top.id, { pin, untrack });
  }

  // The dashboard's Comments panel (outside this iframe, cross-origin - the canvas is
  // served from the API's own origin, not the dashboard's) can't reach into this page's
  // DOM directly, so "jump to where I left this comment" has to go through postMessage
  // instead. Re-resolves the anchor fresh rather than relying on an already-rendered
  // pin, since a comment whose pin never rendered (position-tracker.ts's
  // intersectsViewport hid it as off-screen, or the target simply hadn't loaded yet at
  // init time) can still genuinely exist on the page - "no pin visible right now" was
  // never "the comment is gone."
  window.addEventListener("message", (event) => {
    if (event.data?.type !== "backline:scroll-to-comment") return;
    const topId = event.data.commentId as string | undefined;
    const messages = topId ? threadMessages.get(topId) : undefined;
    if (!topId || !messages || messages.length === 0) return;

    const element = resolveAnchorElement(messages[0].anchor);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    // Give the scroll (and position-tracker's own viewport re-check) a moment to
    // settle before opening the thread.
    setTimeout(() => {
      // Prefer the pin's own live position - the same one clicking the pin directly
      // uses (attachPinClickHandler) - over recomputing from the element's raw
      // top-left corner. The two aren't the same point: a pin keeps the exact
      // click-time offset within its element (trackPinPosition's `offset` param), so
      // a wide/tall anchored element (a whole hero section, say) would otherwise open
      // the thread at its corner - visibly far from where the pin (and the original
      // comment) actually sits.
      const pin = pinsByTopId.get(topId)?.pin;
      const x = pin ? parseFloat(pin.style.left) : element.getBoundingClientRect().left + window.scrollX;
      const y = pin ? parseFloat(pin.style.top) : element.getBoundingClientRect().top + window.scrollY;
      openThreadForComment(topId, x, y);
    }, 400);
  });

  // Realtime signal (12-API-WebSocket.md §12.6): presence is announced just by
  // connecting with this page's id. comment.updated is only surfaced for a comment
  // *this guest created* (a status change on a comment the guest can't act on isn't
  // worth interrupting them for). comment.deleted keeps this page's thread state -
  // pins, and any currently-open thread panel - in sync with deletes made elsewhere
  // (another tab, or the same delete cascading from a "delete thread" call).
  const ownCommentIds = new Set<string>();
  connectReviewSocket(
    config.apiBaseUrl ?? "http://localhost:8000",
    guest.guestSessionToken,
    pageId,
    (type, payload) => {
      if (type === "comment.updated") {
        if (!payload?.id || !ownCommentIds.has(payload.id)) return;
        const label = STATUS_LABELS[payload.status] ?? payload.status;
        showToast(shadow, `Your comment was updated: ${label}`);
        return;
      }

      if (type === "comment.deleted") {
        const commentId: string | undefined = payload?.comment_id;
        if (!commentId) return;
        const parentId: string | null | undefined = payload?.parent_id;
        const topId = parentId ?? commentId;

        const list = threadMessages.get(topId);
        if (list) threadMessages.set(topId, list.filter((c) => c.id !== commentId));

        if (commentId === topId) {
          removeThreadPin(topId);
          if (openThread?.topId === topId) {
            openThread.controls.close();
            openThread = null;
          }
        } else if (openThread?.topId === topId) {
          openThread.controls.setMessages(buildMessages(topId));
        }
      }
    },
  );

  if (!commentingEnabled) return;

  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target || target.closest("[data-backline-root]")) return;

    // Commenting on a link or a submit button must not also trigger its native
    // action - left unprevented, clicking a nav link (or "Book a call", or anything
    // else with an href/type="submit") to leave feedback on it navigates the iframe
    // away from the page entirely. That tears down this whole widget instance (a
    // different page load - potentially a different origin, which the browser can
    // outright block and leave the frame blank) mid-flight, silently dropping
    // in-memory thread/pin state for any comment created moments earlier in the same
    // session. This was found via a genuinely live "Learn more" link on
    // https://example.com pointing at iana.org.
    event.preventDefault();

    // pageX/pageY (document-relative, scroll-inclusive), not clientX/clientY
    // (viewport-relative) - renderPin/openComposer are position: absolute now
    // precisely so the pin/composer scroll with the page instead of drifting off the
    // clicked element the moment the reviewer scrolls.
    const x = event.pageX;
    const y = event.pageY;
    const pin = renderPin(shadow, x, y);
    // Tracks from the moment the pin exists (composing included), using the exact
    // clicked element directly - no anchor/selector resolution needed, this element
    // reference is already unambiguous. The offset preserves exactly where within the
    // element the reviewer clicked, rather than snapping to the element's corner the
    // moment tracking's first frame runs.
    const targetRect = target.getBoundingClientRect();
    const offset = {
      x: x - (targetRect.left + window.scrollX),
      y: y - (targetRect.top + window.scrollY),
    };
    const untrack = trackPinPosition(pin, () => target, offset);

    // M-08 idempotency: generated once per pin/composer, not inside the submit
    // callback, so a future retry affordance on this same composer (UX-AUD-027 is
    // still pending) can resend the identical key instead of minting a new one -
    // the backend replays the original comment for a repeated key rather than
    // creating a duplicate (comments/repository.py's find_by_client_request_id).
    const clientRequestId = crypto.randomUUID();

    const controls = openComposer(
      shadow,
      x,
      y,
      async ({ body, attachments }) => {
        controls.setStatus("Capturing anchor + screenshot...");

        const anchor = await computeAnchor(target, x, y);
        const screenshotBlob = await captureScreenshot();

        let screenshotKey: string | null = null;
        if (screenshotBlob) {
          controls.setStatus("Uploading screenshot...");
          screenshotKey = await uploadScreenshot(
            api,
            guest.guestSessionToken,
            projectId,
            screenshotBlob,
          );
        }

        controls.setStatus("Posting comment...");
        const { browser, os, device_type: deviceType } = parseUserAgent(navigator.userAgent);

        try {
          const created = await api.request<CommentRecord>(`/api/v1/pages/${pageId}/comments`, {
            method: "POST",
            guestToken: guest.guestSessionToken,
            body: JSON.stringify({
              body,
              anchor,
              context: {
                browser,
                os,
                device_type: deviceType,
                viewport: { width: window.innerWidth, height: window.innerHeight },
                url: window.location.href,
              },
              screenshot_key: screenshotKey,
              capture_status: screenshotKey ? "ok" : "failed",
              attachments,
              client_request_id: clientRequestId,
            }),
          });
          ownCommentIds.add(created.id);
          threadMessages.set(created.id, [created]);
          pinsByTopId.set(created.id, { pin, untrack });
          attachPinClickHandler(pin, created.id);
          tooltip.dismiss();
          controls.setStatus("Comment posted.");
        } catch {
          controls.setStatus("Could not post your comment. Please try again.");
        }
      },
      () => {
        untrack();
        pin.remove();
      },
      (file) => uploadAttachment(api, guest.guestSessionToken, projectId, file),
    );
  });
}

declare global {
  interface Window {
    Backline: { init: typeof init };
  }
}

window.Backline = { init };
