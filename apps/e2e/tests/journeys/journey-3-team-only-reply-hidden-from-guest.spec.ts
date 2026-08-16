import AxeBuilder from "@axe-core/playwright";
import { expect, request, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../../helpers/login";
import { openWidgetTestSite, postCommentViaWidget } from "../../helpers/widget";

const API_BASE_URL = process.env.API_BASE_URL ?? "http://localhost:8000";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// 19-Testing-CI.md §19.3 journey #3: "Team member posts a team-only reply -> guest
// re-opens the same thread -> team-only reply is absent from the guest's view - this is
// the test that actually proves F3's security requirement, not just a UI check: assert
// against the raw API response the guest session receives, not just what's rendered."
//
// The dashboard's Board never had a reply UI before this milestone (Milestone 12) - this
// journey exercises the new CommentThreadPanel for the "team member posts a reply" half,
// then drops to a raw API call for the guest half, exactly as the spec asks: the
// widget itself has no thread-reading UI at all (by design - a guest only ever creates
// comments), so "re-opens the same thread" is a second `GET .../comments` call with the
// guest's own session token, the same request the widget would make if it ever grew one.
test("guest's raw API response never includes a team-only reply", async ({ page, browser }) => {
  const email = `journey3-${Date.now()}@example.com`;
  await loginViaOtp(page, email);
  const workspaceSlug = await createWorkspace(page, `Journey3 ${Date.now()}`);
  const projectId = await createProject(page, "Client Site", "https://example.com");
  const shareToken = await createShareLink(page, workspaceSlug, projectId);

  const guestContext = await browser.newContext();
  const guestPage = await guestContext.newPage();
  await openWidgetTestSite(guestPage, shareToken);
  const { guestSessionToken, pageId } = await postCommentViaWidget(
    guestPage,
    shareToken,
    `Journey 3 client comment ${Date.now()}`,
  );

  await page.goto(`/w/${workspaceSlug}/p/${projectId}/board`);
  await expect(page.locator("text=Reply").first()).toBeVisible({ timeout: 15_000 });
  await page.click("text=Reply");

  // The CommentThreadPanel (this milestone's new UI) has never had an axe pass.
  await page.waitForSelector('[role="dialog"]');
  const panelScan = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(panelScan.violations, JSON.stringify(panelScan.violations, null, 2)).toEqual([]);

  const teamOnlyBody = `Internal note ${Date.now()} - do not show the client`;
  await page.fill('[role="dialog"] textarea', teamOnlyBody);
  await page.selectOption('[role="dialog"] select[aria-label="Reply visibility"]', "team");
  await page.click('[role="dialog"] button:has-text("Post reply")');

  // The member's own dashboard shows it immediately (thread panel, team-layer badge).
  await expect(page.locator(`[role="dialog"] :text("${teamOnlyBody}")`)).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator('[role="dialog"] span:has-text("Team only")')).toBeVisible();

  // The guest's own raw API response - the actual security boundary, not the UI - must
  // never contain it, using the exact request shape 07-Review-SDK.md's widget makes.
  const guestApi = await request.newContext({ baseURL: API_BASE_URL });
  const guestResp = await guestApi.get(`/api/v1/pages/${pageId}/comments`, {
    headers: { "X-Guest-Session": guestSessionToken },
  });
  expect(guestResp.ok()).toBe(true);
  const guestComments = (await guestResp.json()) as Array<{ body: string; layer: string }>;
  expect(guestComments.every((c) => c.layer === "client")).toBe(true);
  expect(guestComments.some((c) => c.body === teamOnlyBody)).toBe(false);

  await guestContext.close();
  await guestApi.dispose();
});
