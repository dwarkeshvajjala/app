import { createApiClient } from "./api-client";
import { computeAnchor } from "./anchor";
import { captureSnapshot } from "./dom-snapshot";
import { ensureGuestSession } from "./guest-session";
import { captureScreenshot } from "./screenshot";
import type { BacklineConfig, CapturePayload } from "./types";
import { createShadowRoot, openComposer, promptForName, renderPin, showTooltip } from "./ui";

interface RegisterPageResponse {
  id: string;
}

interface UploadResponse {
  upload_url: string;
  key: string;
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
        screenshotKey = await uploadScreenshot(api, guest.guestSessionToken, projectId, screenshotBlob);
      }

      const payload: CapturePayload = {
        anchor,
        metadata: {
          url: window.location.href,
          viewport: { width: window.innerWidth, height: window.innerHeight },
          user_agent: navigator.userAgent,
        },
        screenshot_key: screenshotKey,
        capture_status: screenshotKey ? "ok" : "failed",
      };

      // Comment submission is Milestone 4 - the snapshot and screenshot are genuinely
      // captured and stored (M3's Definition of Done); posting `body` alongside them
      // as a real comment happens once POST /pages/{id}/comments exists.
      console.info("[Backline] capture ready (comment posting lands in Milestone 4):", {
        body,
        ...payload,
      });
      controls.setStatus("Captured. Posting comments arrives in Milestone 4.");
    });
  });
}

declare global {
  interface Window {
    Backline: { init: typeof init };
  }
}

window.Backline = { init };
