import { type Browser, chromium, expect, test } from "@playwright/test";
import { playAudit } from "playwright-lighthouse";

import { createProject, createWorkspace, loginViaOtp } from "../helpers/login";

const LIGHTHOUSE_PORT = 9222;
// 19-Testing-CI.md §19.5: "Lighthouse CI on the dashboard's board view, budget: Time to
// Interactive < 2.5s on a throttled connection profile" - lighthouse:default already
// simulates a throttled mobile connection, so no custom config is needed to get that.
const TTI_BUDGET_MS = 2500;

let browser: Browser;

test.beforeAll(async () => {
  // playwright-lighthouse drives Lighthouse over the same CDP connection the browser was
  // launched with, so it can audit a page that's already authenticated in this browser
  // context rather than an anonymous fresh tab.
  browser = await chromium.launch({ args: [`--remote-debugging-port=${LIGHTHOUSE_PORT}`] });
});

test.afterAll(async () => {
  await browser.close();
});

test("board view meets the Time to Interactive performance budget", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();

  const email = `perf-${Date.now()}@example.com`;
  await loginViaOtp(page, email);
  const workspaceSlug = await createWorkspace(page, `Perf ${Date.now()}`);
  const projectId = await createProject(page, "Perf Project", "https://example.com");
  await page.goto(`/w/${workspaceSlug}/p/${projectId}/board`);
  await page.waitForSelector("text=Board", { timeout: 15_000 });

  const { lhr } = await playAudit({
    page,
    port: LIGHTHOUSE_PORT,
    disableLogs: true,
    // We assert the raw "interactive" metric ourselves below rather than category scores -
    // omitting `thresholds` entirely trips a chalk-version bug in playwright-lighthouse
    // 4.0.0's "no thresholds set" warning path, and an empty object makes it derive an
    // empty `onlyCategories` list, which Lighthouse itself rejects. A single 0 threshold
    // sidesteps both without ever failing the build on category score.
    thresholds: { performance: 0 },
  });

  const tti = lhr.audits["interactive"]?.numericValue;
  expect(tti, `Lighthouse "interactive" audit: ${JSON.stringify(lhr.audits["interactive"])}`)
    .toBeLessThan(TTI_BUDGET_MS);
});
