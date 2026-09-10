import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, loginViaOtp } from "../../helpers/login";

// Journey 7: AI Features in Comment Threads
// Verifies that the "Summarize" and "Suggest Replies" buttons exist and function.
test("agency manages tickets and uses AI features", async ({ page }) => {
  const email = `journey7-${Date.now()}@example.com`;
  await loginViaOtp(page, email);

  const workspaceSlug = await createWorkspace(page, `Journey7 ${Date.now()}`);
  const projectId = await createProject(page, "AI Site", "https://example.com");

  // Create a comment via the API so we have a thread to look at.
  // The workspace slug is technically not the ID, but the backend allows ID or slug.
  // Wait, the backend might need the actual workspace ID.
  // Actually, createWorkspace returns the slug. The API requires workspace_id, but the UI routes by slug.
  // Let's grab the actual workspace ID.
  const wsRes = await page.request.get("/api/v1/workspaces");
  const wsJson = await wsRes.json();
  const wsId = wsJson[0].id;

  const res = await page.request.post(`/api/v1/workspaces/${wsId}/projects/${projectId}/comments`, {
    data: {
      layer: "client",
      body: "Test comment for AI summary.",
      status: "todo",
      priority: "medium",
      tag: "Bug",
      anchor: {
        tier: 1,
        dom_fingerprint: { selector_path: "body", tag: "body", attributes: {}, node_hash: "hash", ancestor_path_hash: "hash", click_offset_pct: { x: 0, y: 0 } },
        text_fingerprint: { normalized_text: "test", text_similarity_hash: "hash" }
      },
      context: { browser: "Chrome", os: "Windows", viewport: { width: 1000, height: 1000 } }
    }
  });
  expect(res.ok()).toBeTruthy();

  await page.goto(`/w/${workspaceSlug}/tickets?project_id=${projectId}`);
  
  // Need to make sure we're in List view to see the table row
  const listButton = page.getByRole("button", { name: "List" });
  await listButton.click();

  await page.waitForSelector(".bl-table-row");

  // Click the comment to open the side panel
  await page.click(".bl-table-row");
  
  // Verify side panel opens
  await expect(page.locator(".bl-side-panel")).toBeVisible();
  await expect(page.locator(".bl-group-title", { hasText: "Conversation" })).toBeVisible();

  // Test Summarize button
  const summarizeBtn = page.getByRole("button", { name: "✨ Summarize" });
  await expect(summarizeBtn).toBeVisible();
  await summarizeBtn.click();
  await expect(page.locator("text=✨ AI Summary:")).toBeVisible();

  // Test Suggest Replies button
  const suggestBtn = page.getByRole("button", { name: "✨ Suggest Replies" });
  await expect(suggestBtn).toBeVisible();
  await suggestBtn.click();
  
  // AI suggests a reply and we click it
  const chipBtn = page.locator(".bl-chip").first();
  await expect(chipBtn).toBeVisible();
  await chipBtn.click();
  
  // Check if text was injected into the textarea
  const textarea = page.locator(".bl-form textarea");
  await expect(textarea).not.toBeEmpty();
});
