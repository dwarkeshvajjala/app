import { expect, test } from "@playwright/test";

import { createWorkspace, loginViaOtp } from "../../helpers/login";

// Journey 6: Integrations and Billing placeholders
// This test verifies that the integrations (Slack/Clickup) and billing pages render correctly
// as placeholders, without attempting mock transactions.
test("agency manages integrations and views billing placeholder", async ({ page }) => {
  const email = `journey6-${Date.now()}@example.com`;
  await loginViaOtp(page, email);

  const workspaceSlug = await createWorkspace(page, `Journey6 ${Date.now()}`);

  // Navigate to integrations page
  await page.goto(`/w/${workspaceSlug}/integrations`);

  const integrationsHeader = page.getByRole("heading", { name: "Integrations" });
  await expect(integrationsHeader).toBeVisible();

  // Verify that Slack, ClickUp, and Trello cards exist
  await expect(page.getByText("Slack")).toBeVisible();
  await expect(page.getByText("ClickUp")).toBeVisible();
  await expect(page.getByText("Trello")).toBeVisible();

  // Navigate to billing page
  await page.goto(`/w/${workspaceSlug}/billing`);

  const billingHeader = page.getByRole("heading", { name: "Billing" });
  await expect(billingHeader).toBeVisible();

  // Verify the non-functional placeholder warning is present
  await expect(page.getByText(/Prices, checkout, invoices, and server-enforced plan limits are coming soon/i)).toBeVisible();
  
  // Click About future plans
  const futurePlansButton = page.getByRole("button", { name: "About future plans" });
  await expect(futurePlansButton).toBeVisible();
  await futurePlansButton.click();

  // Verify modal opens
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Pro and Team Plans/i)).toBeVisible();
});
