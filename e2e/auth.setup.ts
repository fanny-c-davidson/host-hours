import { test as setup, expect } from "@playwright/test";
import path from "node:path";

const authFile = path.join(__dirname, ".auth/user.json");

/**
 * Logs in once with a real test account and saves the session so the
 * authenticated specs ("app" project) don't each have to log in.
 *
 * Requires E2E_EMAIL and E2E_PASSWORD in the environment.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing E2E_EMAIL / E2E_PASSWORD. Set them to a test account to run the authenticated specs.\n" +
        "Example: E2E_EMAIL=test@example.com E2E_PASSWORD=... npx playwright test",
    );
  }

  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: /^sign in$/i }).click();

  // A successful login redirects to the dashboard.
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

  await page.context().storageState({ path: authFile });
});
