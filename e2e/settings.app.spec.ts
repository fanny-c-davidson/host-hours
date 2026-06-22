import { test, expect } from "@playwright/test";

/**
 * Settings page. Read-only (does not sign out or mutate).
 */

test.describe("settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings");
  });

  test("loads with the account section", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible();
    await expect(page.getByText(/edit profile/i)).toBeVisible();
    await expect(page.getByText(/change password/i)).toBeVisible();
  });

  test("shows the target & goal card", async ({ page }) => {
    await expect(page.getByText(/target & goal/i)).toBeVisible();
    await expect(page.getByText(/^goal$/i).first()).toBeVisible();
  });

  test("has a sign-out control", async ({ page }) => {
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();
  });

  test("can open Edit profile", async ({ page }) => {
    await page.getByText(/edit profile/i).click();
    await expect(page).toHaveURL(/\/settings\/profile/);
  });
});
