import { test, expect } from "@playwright/test";

/**
 * Authenticated dashboard. Read-only.
 */

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("loads for a logged-in user", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // Settings avatar/link is always present in the header.
    await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  });

  test("offers the core entry points (timer + log)", async ({ page }) => {
    await expect(page.getByRole("link", { name: /timer/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /log/i }).first()).toBeVisible();
  });

  test("navigates to the timer", async ({ page }) => {
    await page.getByRole("link", { name: /timer/i }).first().click();
    await expect(page).toHaveURL(/\/timer/);
  });

  test("does not bounce an authenticated user back to login", async ({ page }) => {
    await expect(page).not.toHaveURL(/\/login/);
  });
});
