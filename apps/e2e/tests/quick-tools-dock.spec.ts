import { expect, test } from "@playwright/test";
import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../helpers/login";

test.describe("quick tools dock & shortcuts", () => {
  async function setUpProject(page: import("@playwright/test").Page, label: string) {
    const email = `${label}-${Date.now()}@example.com`;
    await loginViaOtp(page, email);
    const workspaceSlug = await createWorkspace(page, `${label} ${Date.now()}`);
    const projectId = await createProject(page, "Client Site", "https://example.com");
    await createShareLink(page, workspaceSlug, projectId);
    await page.goto(`/w/${workspaceSlug}/p/${projectId}`);
    await page.waitForSelector('button[aria-label="Details"]', { timeout: 10_000 });
  }

  test("dock renders, can toggle mode, and can open shortcuts modal", async ({ page }) => {
    await setUpProject(page, "quickdock");

    // Check if the quick tools dock is visible
    const dock = page.locator('.bl-quick-dock');
    await expect(dock).toBeVisible();

    // Check if environment label is present (e.g., 'production')
    const envBtn = dock.locator('.bl-dock-env');
    await expect(envBtn).toBeVisible();

    // Test mode switching via the dock
    const commentBtn = dock.locator('button[aria-label="Comment (C)"]');
    await commentBtn.click();
    
    // Check that mode changed to comment in the stage (ProjectOverviewPage sets "is-commenting" class)
    const stage = page.locator('.bl-review-stage');
    await expect(stage).toHaveClass(/is-commenting/);

    // Test the More menu
    const moreBtn = dock.locator('button[aria-label="More"]');
    await moreBtn.click();
    const shortcutsBtn = dock.locator('button:has-text("Keyboard Shortcuts")');
    await expect(shortcutsBtn).toBeVisible();
    await shortcutsBtn.click();

    // The Shortcuts Modal should be visible
    const shortcutsModal = page.locator('[aria-labelledby="shortcuts-title"]');
    await expect(shortcutsModal).toBeVisible();

    // Test closing the shortcuts modal
    await shortcutsModal.locator('button[aria-label="Close"]').click();
    await expect(shortcutsModal).toBeHidden();
  });

  test("hiding the dock via shortcut and preferences", async ({ page }) => {
    await setUpProject(page, "dockhide");

    const dock = page.locator('.bl-quick-dock');
    await expect(dock).toBeVisible();

    // Hide via menu
    await page.locator('.bl-quick-dock button[aria-label="More"]').click();
    await page.locator('.bl-dock-menu-item:has-text("Hide Toolbar")').click();

    // Dock should be hidden
    await expect(dock).toBeHidden();

    // Show via keyboard shortcut Ctrl+.
    await page.keyboard.press('Control+.');
    await expect(dock).toBeVisible();
  });
});
