import { expect, test } from "@playwright/test";
import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../helpers/login";

test.describe("Draw Mode", () => {
  test("can switch to draw mode via the quick tools dock and back to browse", async ({ page }) => {
    const email = `drawmode-${Date.now()}@example.com`;
    await loginViaOtp(page, email);
    const workspaceSlug = await createWorkspace(page, `Draw Mode ${Date.now()}`);
    const projectId = await createProject(page, "Client Site", "https://example.com");
    await createShareLink(page, workspaceSlug, projectId);
    await page.goto(`/w/${workspaceSlug}/p/${projectId}`);
    await page.waitForSelector(".bl-quick-dock", { timeout: 10_000 });

    const drawBtn = page.locator('.bl-dock-btn[title="Draw Region (D)"]');
    await drawBtn.click();

    // ProjectOverviewPage sets both is-commenting (draw mode still invites clicking
    // the canvas) and is-drawing on the stage, and marks the dock button active.
    const stage = page.locator(".bl-review-stage");
    await expect(stage).toHaveClass(/is-commenting/);
    await expect(stage).toHaveClass(/is-drawing/);
    await expect(drawBtn).toHaveClass(/active/);

    // Switching back to Browse (via the header toggle) drops both classes and
    // deactivates the dock's draw button.
    await page.locator('.bl-review-mode button[aria-pressed]', { hasText: "Browse" }).click();
    await expect(stage).toHaveClass(/is-browsing/);
    await expect(stage).not.toHaveClass(/is-drawing/);
    await expect(drawBtn).not.toHaveClass(/active/);
  });
});
