import { useEffect, useRef, useState } from "react";

import { ApiError, apiFetch } from "../../lib/api-client";

// Mirrors backend/app/modules/browser_render/schemas.py's RenderStatusOut. Hand-typed
// rather than routed through @backline/types' generated Schemas: that file is produced
// by running the API and pointing openapi-typescript at its live /openapi.json (see
// packages/types/package.json's "generate" script), which this session couldn't do
// without a running Mongo/Redis/R2 stack - regenerate it for real once this ships, at
// which point these can switch to `Schemas["RenderStatusOut"]` etc. like every other
// type in this file's sibling api.ts.
export type RenderJobStatus = "queued" | "rendering" | "ready" | "failed";

export interface BrowserRenderStatus {
  status: RenderJobStatus;
  browser: string;
  viewport: { width: number; height: number };
  orientation: "portrait" | "landscape";
  screenshot_url: string | null;
  rendered_at: string | null;
  error: string | null;
}

export interface RequestRenderBody {
  browser: string;
  viewport: { width: number; height: number };
  orientation: "portrait" | "landscape";
  force?: boolean;
}

export function requestBrowserRender(
  projectId: string,
  pageId: string,
  body: RequestRenderBody,
): Promise<BrowserRenderStatus> {
  return apiFetch<BrowserRenderStatus>(`/api/v1/projects/${projectId}/pages/${pageId}/render`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getBrowserRenderStatus(
  projectId: string,
  pageId: string,
  params: { browser: string; width: number; height: number; orientation: "portrait" | "landscape" },
): Promise<BrowserRenderStatus> {
  const search = new URLSearchParams({
    browser: params.browser,
    width: String(params.width),
    height: String(params.height),
    orientation: params.orientation,
  });
  return apiFetch<BrowserRenderStatus>(
    `/api/v1/projects/${projectId}/pages/${pageId}/render?${search.toString()}`,
  );
}

// Polls a queued/rendering job until it settles. A real headless-browser launch + page
// load routinely takes several seconds (service.py's own comment on why the
// request/poll split exists at all), so this is intentionally a plain interval rather
// than a single re-check.
const POLL_INTERVAL_MS = 2000;

interface UseBrowserRenderSnapshotArgs {
  projectId: string | null;
  pageId: string | null;
  browser: string;
  width: number;
  height: number;
  orientation: "portrait" | "landscape";
  // Only fetch when the caller has actually chosen a non-default browser and the
  // project has the project-settings toggle on - see ProjectOverviewPage.tsx's
  // isCrossBrowserRenderActive. Keeps this hook a no-op for every project that hasn't
  // opted in, matching every other settings-gated flag in this codebase.
  enabled: boolean;
}

export function useBrowserRenderSnapshot({
  projectId,
  pageId,
  browser,
  width,
  height,
  orientation,
  enabled,
}: UseBrowserRenderSnapshotArgs): {
  status: BrowserRenderStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [status, setStatus] = useState<BrowserRenderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !pageId || width <= 0 || height <= 0) {
      setStatus(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const force = nonce > 0;

    function stopPolling() {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    async function poll() {
      try {
        const next = await getBrowserRenderStatus(projectId!, pageId!, {
          browser,
          width,
          height,
          orientation,
        });
        if (cancelled) return;
        setStatus(next);
        if (next.status === "ready" || next.status === "failed") stopPolling();
      } catch (err) {
        if (cancelled) return;
        stopPolling();
        setError(err instanceof ApiError ? err.message : "Couldn't check the render status.");
      }
    }

    async function start() {
      try {
        const initial = await requestBrowserRender(projectId!, pageId!, {
          browser,
          viewport: { width, height },
          orientation,
          force,
        });
        if (cancelled) return;
        setError(null);
        setStatus(initial);
        if (initial.status === "queued" || initial.status === "rendering") {
          pollRef.current = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Couldn't request a browser render.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopPolling();
    };
    // nonce is bumped by refresh() below purely to force a fresh `force:true` request;
    // it is intentionally the only thing in this array that doesn't describe *what* to
    // render.
  }, [enabled, projectId, pageId, browser, width, height, orientation, nonce]);

  return {
    status,
    isLoading: status === null || status.status === "queued" || status.status === "rendering",
    error,
    refresh: () => setNonce((n) => n + 1),
  };
}
