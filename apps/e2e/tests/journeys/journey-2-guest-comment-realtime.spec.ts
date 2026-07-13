import { expect, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../../helpers/login";
import { openWidgetTestSite, postCommentViaWidget } from "../../helpers/widget";

// 19-Testing-CI.md §19.3 journey #2: "Guest opens share link on a mobile viewport ->
// posts a comment in under the SDK's performance budget -> agency dashboard receives it
// via WebSocket without a manual refresh." Two independent, real browser sessions -
// the dashboard's WebSocket connection genuinely has to deliver the event; nothing here
// polls or reloads to make the assertion pass.
test("guest posts a comment on mobile; dashboard receives it live over WebSocket", async ({
  page,
  browser,
}) => {
  const email = `journey2-${Date.now()}@example.com`;
  await loginViaOtp(page, email);
  const workspaceSlug = await createWorkspace(page, `Journey2 ${Date.now()}`);
  const projectId = await createProject(page, "Client Site", "https://example.com");
  const shareToken = await createShareLink(page, workspaceSlug, projectId);

  await page.goto(`/w/${workspaceSlug}/p/${projectId}/board`);
  await page.waitForSelector("text=Board", { timeout: 15_000 });

  const mobileContext = await browser.newContext({ viewport: { width: 375, height: 667 } });
  const guestPage = await mobileContext.newPage();
  const commentBody = `Journey 2 live comment ${Date.now()}`;

  const postedAt = Date.now();
  await openWidgetTestSite(guestPage, shareToken);
  await postCommentViaWidget(guestPage, shareToken, commentBody);
  const sdkElapsedMs = Date.now() - postedAt;

  // The dashboard was never told to refetch - only the live WebSocket upsert
  // (BoardPage's upsertComment, useWSEvent("comment.created", ...)) can make this
  // assertion pass.
  await expect(page.locator(`text=${commentBody}`)).toBeVisible({ timeout: 10_000 });

  // Not the literal 30s "link-tap to posted" human UX metric (01-Product-Vision.md
  // §1.10), which needs a real participant - but a sanity budget that the automated
  // widget flow itself (name prompt already dismissed, guest reused) isn't pathologically
  // slow against a local stack.
  expect(sdkElapsedMs).toBeLessThan(15_000);

  await mobileContext.close();
});
