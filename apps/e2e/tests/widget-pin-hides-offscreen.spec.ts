import { expect, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../helpers/login";
import { openWidgetTestSite, postCommentViaWidget } from "../helpers/widget";

// A real complaint found by hand: a pin correctly followed its element while scrolling
// (widget-pin-scroll.spec.ts), but that also meant it stayed visible flying up/down the
// page as the target scrolled far out of the viewport - looking like the comment was
// detaching and floating away, rather than just disappearing until its card scrolls
// back into view. position-tracker.ts's intersectsViewport now hides the pin the
// moment its target has zero overlap with the viewport, same codepath as "element not
// found," and shows it again the instant any part of the target re-enters view.
test("a pin hides once its element scrolls out of the viewport, and reappears when it's back", async ({
  page,
}) => {
  const email = `pinoffscreen-${Date.now()}@example.com`;
  await loginViaOtp(page, email);
  const workspaceSlug = await createWorkspace(page, `PinOffscreen ${Date.now()}`);
  const projectId = await createProject(page, "Client Site", "https://example.com");
  const shareToken = await createShareLink(page, workspaceSlug, projectId);

  await openWidgetTestSite(page, shareToken);
  await postCommentViaWidget(page, shareToken, "Track me", {
    clickSelector: "h2:has-text('Pricing')",
  });
  await expect(page.locator(".bl-pin")).toBeVisible();

  // The test-site's tall spacer div (apps/widget/test-site/index.html) puts well over a
  // screen's worth of empty space below the Pricing card - scrolling to the bottom
  // takes it completely out of view.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator(".bl-pin")).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".bl-pin")).toBeVisible();
});
