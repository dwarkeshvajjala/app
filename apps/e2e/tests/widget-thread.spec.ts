import { expect, test } from "@playwright/test";

import { createProject, createShareLink, createWorkspace, loginViaOtp } from "../helpers/login";
import { openWidgetTestSite, postCommentViaWidget } from "../helpers/widget";

// Multi-message threads (reply), editing your own message, and deleting a single
// message or a whole thread - apps/widget/src/ui.ts's openThreadView, scoped by the
// governing product decision this feature was built under: only a comment's own author
// may delete/edit it, and this is the widget canvas's own surface (not the dashboard's
// CommentThreadPanel) for this pass.
test.describe("comment threads: existing pins, reply, edit, and delete", () => {
  async function setUpProject(page: import("@playwright/test").Page, label: string) {
    const email = `${label}-${Date.now()}@example.com`;
    await loginViaOtp(page, email);
    const workspaceSlug = await createWorkspace(page, `${label} ${Date.now()}`);
    const projectId = await createProject(page, "Client Site", "https://example.com");
    return createShareLink(page, workspaceSlug, projectId);
  }

  test("an existing comment's pin survives reload and opens its thread on click", async ({
    page,
  }) => {
    const shareToken = await setUpProject(page, "thread1");
    await openWidgetTestSite(page, shareToken);
    await postCommentViaWidget(page, shareToken, "Original message", {
      displayName: "Thread Tester",
    });

    // Reload to prove this comes from the fetch-and-render-existing-comments path
    // (index.ts), not just the in-memory pin left over from creating it.
    await page.reload();
    await expect(page.locator(".bl-pin")).toHaveCount(1, { timeout: 10_000 });

    await page.click(".bl-pin");
    await expect(page.locator(".bl-thread")).toBeVisible();
    await expect(page.locator(".bl-thread-message-body")).toHaveText("Original message");
    await expect(page.locator(".bl-thread-message-author")).toHaveText("You");
  });

  test("replying appends a message; deleting the reply leaves the original intact", async ({
    page,
  }) => {
    const shareToken = await setUpProject(page, "thread2");
    await openWidgetTestSite(page, shareToken);
    await postCommentViaWidget(page, shareToken, "Original message", {
      displayName: "Thread Tester",
    });

    await page.click(".bl-pin");
    await expect(page.locator(".bl-thread")).toBeVisible();

    await page.fill(".bl-thread-reply textarea", "A reply");
    await page.click(".bl-reply-submit");
    await expect(page.locator(".bl-thread-message")).toHaveCount(2);

    const reply = page.locator(".bl-thread-message").nth(1);
    await reply.locator(".bl-menu-trigger").click();
    await reply.locator("button.bl-delete-message").click();
    await expect(page.locator(".bl-thread-message")).toHaveCount(1);
    await expect(page.locator(".bl-thread-message-body")).toHaveText("Original message");
    // Deleting a reply doesn't touch the thread's own pin.
    await expect(page.locator(".bl-pin")).toHaveCount(1);
  });

  test("editing a message updates its body; the panel has no explicit close button", async ({
    page,
  }) => {
    const shareToken = await setUpProject(page, "thread5");
    await openWidgetTestSite(page, shareToken);
    await postCommentViaWidget(page, shareToken, "Original message", {
      displayName: "Thread Tester",
    });

    await page.click(".bl-pin");
    await expect(page.locator(".bl-thread")).toBeVisible();
    // Ruttl-style header: a "..." menu (only when the viewer can delete the thread),
    // no separate "x" - dismissal is click-elsewhere only, same as the composer.
    await expect(page.locator('.bl-thread-header button[aria-label="Close"]')).toHaveCount(0);

    const message = page.locator(".bl-thread-message").first();
    await message.locator(".bl-menu-trigger").click();
    await message.locator("button.bl-edit-message").click();

    const editTextarea = message.locator(".bl-edit-textarea");
    await expect(editTextarea).toHaveValue("Original message");
    await editTextarea.fill("Edited message");
    await message.locator("button.bl-edit-save").click();

    await expect(page.locator(".bl-thread-message-body")).toHaveText("Edited message");
    await expect(page.locator(".bl-edit-textarea")).toHaveCount(0);

    // Reload to prove the edit was actually persisted server-side, not just local state.
    await page.reload();
    await expect(page.locator(".bl-pin")).toHaveCount(1, { timeout: 10_000 });
    await page.click(".bl-pin");
    await expect(page.locator(".bl-thread-message-body")).toHaveText("Edited message");
  });

  test("canceling an edit restores the original text without saving", async ({ page }) => {
    const shareToken = await setUpProject(page, "thread6");
    await openWidgetTestSite(page, shareToken);
    await postCommentViaWidget(page, shareToken, "Original message", {
      displayName: "Thread Tester",
    });

    await page.click(".bl-pin");
    const message = page.locator(".bl-thread-message").first();
    await message.locator(".bl-menu-trigger").click();
    await message.locator("button.bl-edit-message").click();
    await message.locator(".bl-edit-textarea").fill("Never mind this");
    await message.locator("button.bl-edit-cancel").click();

    await expect(page.locator(".bl-edit-textarea")).toHaveCount(0);
    await expect(page.locator(".bl-thread-message-body")).toHaveText("Original message");
  });

  test("deleting the whole thread removes its pin", async ({ page }) => {
    const shareToken = await setUpProject(page, "thread3");
    await openWidgetTestSite(page, shareToken);
    await postCommentViaWidget(page, shareToken, "Original message", {
      displayName: "Thread Tester",
    });

    await page.click(".bl-pin");
    await page.click(".bl-thread-menu .bl-menu-trigger");
    await page.click("button.bl-delete-thread");

    await expect(page.locator(".bl-thread")).toHaveCount(0);
    await expect(page.locator(".bl-pin")).toHaveCount(0);
  });

  test("another guest can see but not delete someone else's comment", async ({ browser }) => {
    const setupContext = await browser.newContext();
    const setupPage = await setupContext.newPage();
    const shareToken = await setUpProject(setupPage, "thread4");
    await openWidgetTestSite(setupPage, shareToken);
    await postCommentViaWidget(setupPage, shareToken, "Guest A's comment", {
      displayName: "Guest A",
    });
    await setupContext.close();

    // A second, independent guest (separate browser context - guest identity lives in
    // sessionStorage, scoped per tab, docs/tdr's "only the comment's own author" decision
    // is enforced client-side here too, not just by the backend's 403).
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await openWidgetTestSite(page2, shareToken);
    await page2.waitForSelector('input[placeholder="Jamie"]', { timeout: 10_000 });
    await page2.fill('input[placeholder="Jamie"]', "Guest B");
    await page2.click('button:has-text("Continue")');

    await expect(page2.locator(".bl-pin")).toHaveCount(1, { timeout: 10_000 });
    await page2.click(".bl-pin");
    await expect(page2.locator(".bl-thread-message-body")).toHaveText("Guest A's comment");
    await expect(page2.locator(".bl-thread-message-author")).toHaveText("Guest");
    await expect(page2.locator("button.bl-delete-message")).toHaveCount(0);
    await expect(page2.locator("button.bl-edit-message")).toHaveCount(0);
    await expect(page2.locator("button.bl-delete-thread")).toHaveCount(0);

    await context2.close();
  });
});
