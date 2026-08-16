import { expect, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../helpers/login";
import { openWidgetTestSite, postCommentViaWidget } from "../helpers/widget";

// A real bug found by hand on a client site with an auto-scrolling carousel: a pin's
// position (apps/widget/src/ui.ts's .bl-pin) was captured once, at click time, from
// page coordinates - correct for page *scroll* (position:absolute + pageX/pageY already
// handle that), but the card itself kept moving underneath the pin via its own CSS
// animation, so within a couple of seconds the pin visually belonged to a *different*
// card than the one it was actually left on. Fixed via position-tracker.ts's shared
// requestAnimationFrame loop, which continuously re-reads the anchored element's own
// getBoundingClientRect() and keeps the pin glued to it regardless of why the element's
// on-screen position changed.
test("a pin stays glued to its element while that element moves via CSS animation", async ({
  page,
}) => {
  const email = `pinmove-${Date.now()}@example.com`;
  await loginViaOtp(page, email);
  const workspaceSlug = await createWorkspace(page, `PinMove ${Date.now()}`);
  const projectId = await createProject(page, "Client Site", "https://example.com");
  const shareToken = await createShareLink(page, workspaceSlug, projectId);

  await openWidgetTestSite(page, shareToken);
  // Commented on while stationary (Playwright's click() refuses to act on an element
  // mid-animation), then set moving - closer to the real bug anyway, a card that keeps
  // moving *after* a reviewer already left a comment on it.
  await postCommentViaWidget(page, shareToken, "Track me", {
    clickSelector: "h2:has-text('Auto-scrolling Promo')",
  });
  await page.evaluate(() => (window as unknown as { __startDrift: () => void }).__startDrift());

  async function readPositions() {
    const pinBox = await page.locator(".bl-pin").boundingBox();
    const cardBox = await page.locator("#moving-card").boundingBox();
    if (!pinBox || !cardBox) throw new Error("Missing pin or card bounding box");
    return { pinBox, cardBox };
  }

  const first = await readPositions();
  // The pin marks the click point inside the card (offset from the card's own
  // top-left), not the card's corner exactly - what matters is that it's currently
  // aligned with wherever the card actually is.
  const firstOffsetX = first.pinBox.x - first.cardBox.x;

  await page.waitForTimeout(1500);
  const second = await readPositions();
  const secondOffsetX = second.pinBox.x - second.cardBox.x;

  // The card must have genuinely moved (otherwise this test would pass even without
  // the fix) - and the pin must have moved with it, keeping the same relative offset
  // (a few px of tolerance for animation-timing jitter between the two reads).
  expect(Math.abs(second.cardBox.x - first.cardBox.x)).toBeGreaterThan(50);
  expect(Math.abs(secondOffsetX - firstOffsetX)).toBeLessThan(5);
});
