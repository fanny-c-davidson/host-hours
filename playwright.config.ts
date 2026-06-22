import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for Host Hours.
 *
 * Target:  set BASE_URL to point at the app under test.
 *          Defaults to the local dev server (http://localhost:3000).
 *          ⚠️ Do NOT point write-tests at production — they create real data.
 *
 * Auth:    most specs need a logged-in session. Provide a test account via
 *          E2E_EMAIL / E2E_PASSWORD; auth.setup.ts logs in once and saves the
 *          session to e2e/.auth/user.json, which the app specs reuse.
 *
 * Writes:  data-mutating cases (logging hours, starting a timer) are skipped
 *          unless E2E_WRITE=1, so the default run is read-only and safe.
 */

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // 1. Logs in and persists the session for the authenticated specs.
    { name: "setup", testMatch: /.*\.setup\.ts/ },

    // 2. Public / unauthenticated specs — fresh context, no stored session.
    {
      name: "public",
      testMatch: /.*\.public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },

    // 3. Authenticated app specs — reuse the saved session.
    {
      name: "app",
      testMatch: /.*\.app\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
  ],

  // Auto-start the dev server when testing locally. Reuses one if already up.
  // NOTE: the dev server requires Node 20+ (Node 18 fails silently).
  webServer: BASE_URL.includes("localhost")
    ? {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
