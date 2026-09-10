import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, loginViaOtp } from "../helpers/login";

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

// A single test walking every screen (rather than one test() per screen) because the
// screens are inherently sequential - board/share-links depend on a project that only
// exists after workspace creation, which depends on being logged in. `expect.soft` means
// one screen's real violation doesn't abort the walk and hide findings on later screens;
// everything gets reported together at the end.
test("dashboard screens have no WCAG AA violations (axe-core)", async ({ page }) => {
  async function checkA11y(label: string): Promise<void> {
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => {
      // Remove all iframes from the DOM before running axe-core.
      // This prevents axe from scanning the proxied client site (which we don't control)
      // and the Backline widget (which has a known false-positive color contrast error
      // on its rounded-corner submit button).
      document.querySelectorAll('iframe').forEach(f => f.remove());
    });

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .exclude(["div[data-backline-root='true']"])
      .analyze();
    expect.soft(results.violations, `${label}:\n${JSON.stringify(results.violations, null, 2)}`).toEqual([]);
  }

  await test.step("login page", async () => {
    await page.goto("/login");
    await checkA11y("login page");
  });

  const email = `a11y-${Date.now()}@example.com`;
  await test.step("workspace picker (post sign-in)", async () => {
    await loginViaOtp(page, email);
    await checkA11y("workspace picker");
  });

  let workspaceSlug = "";
  await test.step("workspace home (no projects yet)", async () => {
    workspaceSlug = await createWorkspace(page, `A11y ${Date.now()}`);
    await checkA11y("workspace home (empty state)");
  });

  await test.step("members page", async () => {
    await page.goto(`/w/${workspaceSlug}/members`);
    await checkA11y("members page");
  });

  await test.step("integrations page", async () => {
    await page.goto(`/w/${workspaceSlug}/integrations`);
    await checkA11y("integrations page");
  });

  let projectId = "";
  await test.step("workspace home (after creating a project)", async () => {
    await page.goto(`/w/${workspaceSlug}`);
    projectId = await createProject(page, "A11y Project", "https://example.com");
    await checkA11y("workspace home (with a project listed)");
  });

  await test.step("project overview page", async () => {
    await page.goto(`/w/${workspaceSlug}/p/${projectId}`);
    await checkA11y("project overview page");
  });

  await test.step("board page (kanban view)", async () => {
    await page.goto(`/w/${workspaceSlug}/p/${projectId}/board`);
    await page.waitForSelector("text=Board", { timeout: 15_000 });
    await checkA11y("board page (kanban view)");
  });

  await test.step("board page (list view)", async () => {
    await page.click('button:has-text("List")');
    await checkA11y("board page (list view)");
  });

  await test.step("share links page", async () => {
    await page.goto(`/w/${workspaceSlug}/p/${projectId}/share-links`);
    await checkA11y("share links page");
  });
});
