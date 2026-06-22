import { test, expect } from "@playwright/test";

/**
 * Login page behavior — unauthenticated.
 * The happy-path login is covered by auth.setup.ts; here we cover the page
 * rendering and the invalid-credentials error path (no real account needed).
 */

test.describe("login page", () => {
  test("renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("shows an error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "nobody-e2e@example.com");
    await page.fill('input[name="password"]', "wrong-password-123");
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Stays on /login and surfaces an error; does not reach the dashboard.
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(
      page.getByText(/invalid|incorrect|wrong|could not|failed|credentials/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("forgot-password link is present", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("link", { name: /forgot password/i })).toBeVisible();
  });
});
