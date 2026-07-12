import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";

const BACKEND_LOG_PATH = process.env.BACKEND_LOG_PATH;

// Without a configured RESEND_API_KEY, app/core/email.py logs the OTP code instead of
// emailing it (same local-dev convention every milestone's real-browser verification
// has relied on since M6). BACKEND_LOG_PATH must point at the uvicorn process's stdout.
function readOtpCodeFor(email: string): string {
  if (!BACKEND_LOG_PATH) {
    throw new Error(
      "BACKEND_LOG_PATH env var is required - point it at the running backend's stdout log.",
    );
  }
  const log = readFileSync(BACKEND_LOG_PATH, "utf-8");
  const idx = log.lastIndexOf(`to=${email}`);
  if (idx === -1) throw new Error(`No OTP email logged for ${email}`);
  const chunk = log.slice(idx, idx + 400);
  const match = chunk.match(/<strong>(\d{6})<\/strong>/);
  if (!match) throw new Error(`Could not find a 6-digit code in log chunk: ${chunk}`);
  return match[1];
}

async function waitForUrlMatch(page: Page, pattern: RegExp, timeout = 20_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (pattern.test(page.url())) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for URL to match ${pattern}; last url = ${page.url()}`);
}

/** Logs in via the real OTP flow and lands on the workspace picker. */
export async function loginViaOtp(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.fill('input[type="email"]', email);
  await page.click('button:has-text("Send sign-in code")');
  await page.waitForSelector('input[inputmode="numeric"]', { timeout: 10_000 });
  await page.waitForTimeout(300); // let the backend finish logging the email
  const code = readOtpCodeFor(email);
  await page.fill('input[inputmode="numeric"]', code);
  await page.click('button:has-text("Verify and sign in")');
  await waitForUrlMatch(page, /\/$|\/w\//);
}

/** Creates a brand-new workspace from the picker and returns its slug. */
export async function createWorkspace(page: Page, name: string): Promise<string> {
  await page.waitForSelector("text=Your workspaces", { timeout: 10_000 });
  await page.fill("form input[required]", name);
  await page.click('button:has-text("Create workspace")');
  await waitForUrlMatch(page, /\/w\/[^/]+$/);
  const slug = page.url().split("/w/")[1];
  if (!slug) throw new Error(`Could not parse workspace slug from ${page.url()}`);
  return slug;
}

/** Creates a project from the workspace home page's "New project" form and returns its id. */
export async function createProject(
  page: Page,
  name: string,
  targetOrigin: string,
): Promise<string> {
  await page.waitForSelector("text=New project", { timeout: 10_000 });
  await page.fill('label:has-text("Name") input', name);
  await page.fill('label:has-text("Site URL") input', targetOrigin);
  await page.click('button:has-text("Create project")');
  await page.waitForSelector(`a:has-text("${name}")`, { timeout: 10_000 });
  const href = await page.getAttribute(`a:has-text("${name}")`, "href");
  const match = href?.match(/\/p\/([^/]+)/);
  if (!match) throw new Error(`Could not parse project id from href ${href}`);
  return match[1];
}
