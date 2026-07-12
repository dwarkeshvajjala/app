import { createApiClient } from "./api-client";
import { computeAnchor } from "./anchor";
import { captureSnapshot } from "./dom-snapshot";
import { ensureGuestSession } from "./guest-session";
import { captureScreenshot } from "./screenshot";
import type { BacklineConfig } from "./types";
import { parseUserAgent } from "./user-agent";
import {
  createShadowRoot,
  openComposer,
  promptForName,
  renderPin,
  showToast,
  showTooltip,
} from "./ui";
import { connectReviewSocket } from "./ws-client";

const STATUS_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
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

interface CommentResponse {
  id: string;
  layer: "client" | "team";
}

async function registerCurrentPage(
  api: ReturnType<typeof createApiClient>,
  guestToken: string,
  projectId: string,
): Promise<string> {
  const page = await api.request<RegisterPageResponse>("/api/v1/pages", {
    method: "POST",
    guestToken,
    body: JSON.stringify({
      project_id: projectId,
      url: window.location.href,
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

async function init(config: BacklineConfig): Promise<void> {
  const api = createApiClient(config.apiBaseUrl);
  const shadow = createShadowRoot();

  const guest = await ensureGuestSession(api, config.shareToken, () => promptForName(shadow));

  // We don't yet know the project - it's resolved from the share link server-side via
  // the guest token itself (every endpoint the guest calls checks their share link's
  // project, core/actor_access.py). The widget still needs it for the /uploads call's
  // request body, so it's resolved once here via the public review-resolve endpoint.
  const resolved = await api.request<{ project_id: string }>(
    `/api/v1/review/${config.shareToken}`,
  );
  const projectId = resolved.project_id;

  const pageId = await registerCurrentPage(api, guest.guestSessionToken, projectId);
  await submitPageSnapshot(api, guest.guestSessionToken, pageId);

  showTooltip(shadow);

  // Realtime signal (12-API-WebSocket.md §12.6): presence is announced just by
  // connecting with this page's id. The only event this session reacts to is
  // comment.updated on a comment *this guest created* - a status change on a comment
  // the guest can't currently see rendered isn't worth reconciling against, since the
  // widget doesn't yet keep a local list of every comment on the page (creation only,
  // see docs/tdr/0006).
  const ownCommentIds = new Set<string>();
  connectReviewSocket(
    config.apiBaseUrl ?? "http://localhost:8000",
    guest.guestSessionToken,
    pageId,
    (type, payload) => {
      if (type !== "comment.updated") return;
      if (!payload?.id || !ownCommentIds.has(payload.id)) return;
      const label = STATUS_LABELS[payload.status] ?? payload.status;
      showToast(shadow, `Your comment was updated: ${label}`);
    },
  );

  document.addEventListener("click", (event) => {
    const target = event.target as Element | null;
    if (!target || target.closest("[data-backline-root]")) return;

    const x = event.clientX;
    const y = event.clientY;
    renderPin(shadow, x, y);

    const controls = openComposer(shadow, x, y, async ({ body }) => {
      controls.setStatus("Capturing anchor + screenshot...");

      const anchor = await computeAnchor(target);
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
        const created = await api.request<CommentResponse>(
          `/api/v1/pages/${pageId}/comments`,
          {
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
            }),
          },
        );
        ownCommentIds.add(created.id);
        controls.setStatus("Comment posted.");
      } catch {
        controls.setStatus("Could not post your comment. Please try again.");
      }
    });
  });
}

declare global {
  interface Window {
    Backline: { init: typeof init };
  }
}

window.Backline = { init };
