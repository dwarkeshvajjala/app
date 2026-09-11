import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, loginViaOtp } from "../../helpers/login";

// Journey 8: Browser selection dropdown
// Verifies that a reviewer can select a browser from the footer menu.
test("reviewer selects browser before commenting", async ({ page }) => {
  const email = `journey8-${Date.now()}@example.com`;
  await loginViaOtp(page, email);

  const workspaceSlug = await createWorkspace(page, `Journey8 ${Date.now()}`);
  const projectId = await createProject(page, "Browser Site", "https://example.com");

  await page.goto(`/w/${workspaceSlug}/p/${projectId}`);

  // Open the new comment panel or look for the footer
  const footer = page.locator(".bl-review-statusbar");
  await expect(footer).toBeVisible();

  // Find the browser menu trigger
  const browserTrigger = footer.locator('button[aria-haspopup="menu"]', { hasText: /Chrome|Safari|Firefox|Edge/i }).first();
  await expect(browserTrigger).toBeVisible();
  await browserTrigger.click();

  // The dropdown should appear
  const dropdown = page.locator('.bl-review-popover[aria-label="Browser"]');
  await expect(dropdown).toBeVisible();

  // Click Safari
  await dropdown.getByRole("menuitemradio", { name: "Safari" }).click();

  // Trigger should now show Safari
  await expect(browserTrigger).toContainText("Safari");
});
