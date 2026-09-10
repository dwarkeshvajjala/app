import { expect, test } from "@playwright/test";

import { createProject, createWorkspace, loginViaOtp } from "../../helpers/login";

// Journey 7: Project Cascade Deletion Flow
// Verifies that a project can be archived, and then a permanent deletion dry-run can be requested.
test("agency archives and deletes a project safely", async ({ page }) => {
  const email = `journey7-${Date.now()}@example.com`;
  await loginViaOtp(page, email);

  const workspaceSlug = await createWorkspace(page, `Journey7 ${Date.now()}`);
  const projectId = await createProject(page, "Deletion Target Site", "https://example.com");

  // Navigate to project overview
  await page.goto(`/w/${workspaceSlug}/p/${projectId}`);

  // Open Project options menu
  await page.getByRole("button", { name: "Project options" }).click();

  // Archive the project
  const archiveMenuItem = page.getByRole("menuitem", { name: "Archive project" });
  await expect(archiveMenuItem).toBeVisible();
  await archiveMenuItem.click();
  
  // Confirm archive
  const confirmArchiveButton = page.getByRole("dialog").getByRole("button", { name: "Archive project" });
  await expect(confirmArchiveButton).toBeVisible();
  await confirmArchiveButton.click();

  // Wait for the dialog to disappear
  await expect(page.getByRole("dialog")).toBeHidden();

  // Open Project options menu again
  await page.getByRole("button", { name: "Project options" }).click();

  // Trigger permanent delete
  const deleteMenuItem = page.getByRole("menuitem", { name: "Delete project" });
  await expect(deleteMenuItem).toBeVisible();
  await deleteMenuItem.click();
  
  // Expect dry-run preview modal
  const previewModal = page.getByRole("dialog");
  await expect(previewModal).toBeVisible();
  // Wait for loading to finish, should see the delete button eventually
  const finalDeleteButton = previewModal.getByRole("button", { name: "Delete project forever" });
  
  // Need to type the project name to confirm
  const confirmInput = previewModal.locator('input');
  await expect(confirmInput).toBeVisible();
  await confirmInput.fill("Deletion Target Site");

  // Verify the button becomes enabled
  await expect(finalDeleteButton).toBeEnabled();
});
