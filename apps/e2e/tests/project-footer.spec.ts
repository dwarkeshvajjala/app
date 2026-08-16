import { expect, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../helpers/login";

// The project canvas's bottom footer (ProjectOverviewPage -> footer/ProjectFooter):
// Version history, page approval, and private mode are all Pro features not actually
// implemented yet, so each just leads to the shared paywall rather than doing
// anything real - only Viewport switching and the Browse/Comment split are real,
// working controls, and this suite is scoped to exactly those two.
test.describe("project canvas footer", () => {
  async function setUpProject(page: import("@playwright/test").Page, label: string) {
    const email = `${label}-${Date.now()}@example.com`;
    await loginViaOtp(page, email);
    const workspaceSlug = await createWorkspace(page, `${label} ${Date.now()}`);
    const projectId = await createProject(page, "Client Site", "https://example.com");
    await createShareLink(page, workspaceSlug, projectId);
    await page.goto(`/w/${workspaceSlug}/p/${projectId}`);
    await page.waitForSelector('button[aria-label="Details"]', { timeout: 10_000 });
  }

  test("selecting a device viewport resizes the canvas iframe to its real dimensions", async ({
    page,
  }) => {
    await setUpProject(page, "footerviewport");

    await page.click('button[aria-label="Viewport"]');
    await page.click("text=Samsung A71");

    const iframe = page.locator("iframe");
    await expect(iframe).toHaveJSProperty("clientWidth", 412);
    await expect(iframe).toHaveJSProperty("clientHeight", 914);

    // Desktop resets it back to filling the canvas.
    await page.click('button[aria-label="Viewport"]');
    await page.click("text=Desktop");
    const box = await iframe.boundingBox();
    expect(box?.width).toBeGreaterThan(900);
  });

  test("Browse mode disables click-to-comment; Comment mode (the default) keeps it enabled", async ({
    page,
  }) => {
    await setUpProject(page, "footerbrowse");

    const frame = page.frameLocator("iframe");
    // A fresh guest's name prompt renders immediately (ensureGuestSession awaits it
    // before init() gets anywhere near showTooltip/the click listener) - it has to be
    // handled before waiting for the tooltip, not after, same order
    // helpers/widget.ts's postCommentViaWidget already uses.
    const nameInput = frame.locator('input[placeholder="Jamie"]');
    const namePromptAppeared = await nameInput
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    if (namePromptAppeared) {
      await nameInput.fill("Footer Tester");
      await frame.locator('button:has-text("Continue")').click();
    }
    // The click listener is only attached once init() finishes (snapshot submission +
    // showTooltip) - clicking before that is a real race.
    await frame
      .locator("text=Tap anywhere on the page to leave feedback.")
      .waitFor({ timeout: 10_000 });
    await frame.locator("h1").first().click();
    await expect(frame.locator(".bl-composer")).toHaveCount(1, { timeout: 10_000 });

    await page.click('button[aria-label="Browse mode"]');
    await frame.locator("h1").first().waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await frame.locator("h1").first().click();
    await page.waitForTimeout(500);
    await expect(frame.locator(".bl-composer")).toHaveCount(0);

    await page.click('button[aria-label="Comment mode"]');
    await frame
      .locator("text=Tap anywhere on the page to leave feedback.")
      .waitFor({ timeout: 10_000 });
    await frame.locator("h1").first().click();
    await expect(frame.locator(".bl-composer")).toHaveCount(1, { timeout: 10_000 });
  });

  test("the footer's own Share button opens the collaborators modal", async ({ page }) => {
    await setUpProject(page, "footershare");

    await page.locator("div").locator('button:has-text("Share")').last().click();
    await expect(page.locator('[role="dialog"][aria-label*="Share"]')).toBeVisible();
  });

  test("version, approval, and private mode all lead to the shared pro-feature paywall", async ({
    page,
  }) => {
    await setUpProject(page, "footerpaywall");

    await page.click('button:has-text("Version 1")');
    await page.click("text=+ Add new version");
    await page.click("text=Yes, copy comments to new version");
    await expect(page.locator("text=You just explored a pro feature")).toBeVisible();
    await page.click('[role="dialog"] >> text=Continue using BugHunt for free');

    await page.click('button[aria-label="Approve page"]');
    await expect(page.locator("text=page approval functionality")).toBeVisible();
    await page.click('[role="dialog"] >> text=Continue using BugHunt for free');

    await page.click('button:has-text("Private Mode")');
    await expect(page.locator('[role="dialog"] >> text=private mode')).toBeVisible();
  });
});
