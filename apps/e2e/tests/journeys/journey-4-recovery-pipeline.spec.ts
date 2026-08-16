import { expect, request, test } from "@playwright/test";

import { createProject, createWorkspace, loginViaOtp, trackAuthHeader } from "../../helpers/login";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";
const STABLE_ATTRS = { "data-testid": "upgrade-cta" };

function node(overrides: Record<string, unknown> = {}) {
  return {
    tag: "button",
    attributes: STABLE_ATTRS,
    text: "Upgrade to Pro",
    node_hash: "sha256:node-v1",
    ancestor_path_hash: "sha256:pos-v1",
    text_similarity_hash: "0".repeat(16),
    ...overrides,
  };
}

const ANCHOR = {
  tier: 1,
  dom_fingerprint: {
    selector_path: "body > button:nth-of-type(1)",
    tag: "button",
    attributes: STABLE_ATTRS,
    node_hash: "sha256:node-v1",
    ancestor_path_hash: "sha256:pos-v1",
  },
  text_fingerprint: { normalized_text: "Upgrade to Pro", text_similarity_hash: "0".repeat(16) },
};

const CONTEXT = {
  browser: "Chrome",
  os: "macOS",
  viewport: { width: 1440, height: 900 },
  device_type: "desktop",
  url: "https://reviewable.example.com/",
};

// 19-Testing-CI.md §19.3 journey #4: "Comment's page is redeployed with a structural
// change -> recovery pipeline runs -> comment's recovery_status updates and is reflected
// in the dashboard." Driven through real API calls (there's no UI for submitting a raw
// DOM snapshot - that's the widget's job, and simulating a "redeploy" means posting a
// second snapshot for the same page, which has no dashboard-side trigger at all) but the
// recovery pipeline itself runs for real: a genuine Arq job on the actual Redis queue,
// picked up by the actual worker process (app/workers/main.py), not a direct function
// call - the dashboard has to receive comment.recovery_updated over its real WebSocket
// connection for this test to pass.
test("a structural page change orphans a comment, reflected live on the board", async ({
  page,
}) => {
  const email = `journey4-${Date.now()}@example.com`;
  const getAuthHeader = trackAuthHeader(page);
  await loginViaOtp(page, email);
  const workspaceSlug = await createWorkspace(page, `Journey4 ${Date.now()}`);
  const projectId = await createProject(page, "Client Site", "https://example.com");

  const api = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { Authorization: getAuthHeader() },
  });

  const pageResp = await api.post("/api/v1/pages", {
    data: { project_id: projectId, url: "https://reviewable.example.com/" },
  });
  expect(pageResp.ok()).toBe(true);
  const pageId = (await pageResp.json()).id as string;

  const snap1 = await api.post(`/api/v1/pages/${pageId}/snapshots`, {
    data: {
      viewport: { width: 1440, height: 900 },
      node_tree: { node_id: "n1", tag: "html", children: [] },
      nodes_index: { n1: node() },
      full_page_hash: "sha256:page-v1",
    },
  });
  expect(snap1.ok()).toBe(true);

  const commentResp = await api.post(`/api/v1/pages/${pageId}/comments`, {
    data: {
      body: "This button needs work",
      layer: "client",
      anchor: ANCHOR,
      context: CONTEXT,
      screenshot_key: null,
      capture_status: "ok",
    },
  });
  expect(commentResp.ok()).toBe(true);
  const commentBody = (await commentResp.json()).body as string;

  await page.goto(`/w/${workspaceSlug}/p/${projectId}/board`);
  await expect(page.locator(`text=${commentBody}`)).toBeVisible({ timeout: 15_000 });
  // "ok" recovery status renders no badge at all (RecoveryBadge returns null) - the
  // absence of "Anchor lost"/"Anchor uncertain" text is itself part of the baseline.
  await expect(page.locator("text=Anchor lost")).not.toBeVisible();

  // The "redeploy": a second snapshot whose only node is unrelated to the comment's
  // anchor - the golden-dataset "element removed" case (19-Testing-CI.md §19.2),
  // backend/tests/test_recovery_engine.py's own fixture shape.
  const snap2 = await api.post(`/api/v1/pages/${pageId}/snapshots`, {
    data: {
      viewport: { width: 1440, height: 900 },
      node_tree: { node_id: "n1", tag: "html", children: [] },
      nodes_index: {
        // Maximally dissimilar text_similarity_hash (all-1s vs. the original anchor's
        // all-0s default) - reusing the same default here would look like a text-edit
        // match to the SimHash tier instead of a true removal
        // (backend/tests/test_recovery_engine.py's own golden-dataset fixture shape).
        n2: node({
          tag: "div",
          attributes: {},
          text: "totally unrelated section",
          node_hash: "sha256:unrelated",
          ancestor_path_hash: "sha256:unrelated-pos",
          text_similarity_hash: "f".repeat(16),
        }),
      },
      full_page_hash: "sha256:page-v2",
    },
  });
  expect(snap2.ok()).toBe(true);

  // No refresh, no refetch - only the WebSocket comment.recovery_updated event
  // (BoardPage's patchRecoveryStatus) can make this assertion pass, and only once the
  // real Arq worker has actually finished the job.
  await expect(page.locator("text=Anchor lost")).toBeVisible({ timeout: 30_000 });

  await api.dispose();
});
