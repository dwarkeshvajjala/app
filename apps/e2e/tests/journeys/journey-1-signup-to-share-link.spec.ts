import { expect, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../../helpers/login";

// 19-Testing-CI.md §19.3 journey #1: "Agency signs up (Google OAuth) -> creates
// workspace -> creates project -> generates share link." Google OAuth itself needs real
// Google app credentials to exercise live (same documented gap as M9/M10's Google/
// ClickUp OAuth flows) - the email/OTP signup path exercises the exact same downstream
// flow (workspace -> project -> share link), so it stands in for the auth step here.
test("agency signs up, creates a workspace, a project, and a share link", async ({ page }) => {
  const email = `journey1-${Date.now()}@example.com`;
  await loginViaOtp(page, email);

  const workspaceSlug = await createWorkspace(page, `Journey1 ${Date.now()}`);
  const projectId = await createProject(page, "Client Site", "https://example.com");
  const token = await createShareLink(page, workspaceSlug, projectId);

  expect(token).toMatch(/^[A-Za-z0-9_-]+$/);

  // The share link is real - a guest can resolve it without being logged in as a member.
  const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8000";
  const resolved = await page.request.get(`${apiBaseUrl}/api/v1/review/${token}`);
  expect(resolved.ok()).toBe(true);
  const body = await resolved.json();
  expect(body.project_id).toBe(projectId);
});
