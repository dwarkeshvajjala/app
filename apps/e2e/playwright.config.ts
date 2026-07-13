import { defineConfig } from "@playwright/test";

// Milestone 11 hardening (19-Testing-CI.md §19.1's "Integration - full stack" layer):
// runs against an already-running backend + frontend (local dev, or CI services) -
// this config deliberately has no `webServer` block, since the stack's own processes
// (mongo/redis/minio, uvicorn, vite) need to be started with their real startup
// sequencing (infra/local/start-all.sh, etc.), not spawned ad hoc by Playwright.
export default defineConfig({
  testDir: "./tests",
  // The accessibility suite walks ~9 screens (each with a full axe-core scan) in one
  // test - well past the 30s default that suits single-screen journeys.
  timeout: 120_000,
  retries: 0,
  // Every test in this suite logs in via OTP against one shared backend, and
  // otp/request is IP-rate-limited to 5/min (Milestone 11, core/config.py) - since every
  // worker looks like the same client IP to that backend, running test files in
  // parallel here means the suite rate-limits itself. One shared live stack, one worker.
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.WEB_BASE_URL ?? "http://localhost:5173",
    screenshot: "only-on-failure",
  },
});
