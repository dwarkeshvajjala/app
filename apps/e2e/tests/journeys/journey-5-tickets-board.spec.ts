import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, loginViaOtp } from "../../helpers/login";

// Journey 5: Tickets Board Flow
// This test verifies that the Tickets page loads, and that the board, list, and calendar views can be toggled.
test("agency manages tickets on board and calendar views", async ({ page }) => {
  const email = `journey5-${Date.now()}@example.com`;
  await loginViaOtp(page, email);

  const workspaceSlug = await createWorkspace(page, `Journey5 ${Date.now()}`);
  const projectId = await createProject(page, "Tickets Site", "https://example.com");

  // Navigate to the tickets page
  await page.goto(`/w/${workspaceSlug}/tickets?project_id=${projectId}`);

  // Wait for the tickets page to load
  const header = page.getByRole("heading", { name: "All tickets" });
  await expect(header).toBeVisible();

  // Check the view toggles
  const boardButton = page.getByRole("button", { name: "Board" });
  const listButton = page.getByRole("button", { name: "List" });
  const calendarButton = page.getByRole("button", { name: "Calendar" });

  await expect(boardButton).toBeVisible();
  await expect(listButton).toBeVisible();
  await expect(calendarButton).toBeVisible();

  // Switch to list view
  await listButton.click();
  await expect(page.locator(".bl-table-wrap").first()).toBeVisible();

  // Switch to calendar view
  await calendarButton.click();
  // Ensure calendar renders
  const prevMonthButton = page.getByRole("button", { name: "Previous month" });
  const nextMonthButton = page.getByRole("button", { name: "Next month" });
  await expect(prevMonthButton).toBeVisible();
  await expect(nextMonthButton).toBeVisible();
});
