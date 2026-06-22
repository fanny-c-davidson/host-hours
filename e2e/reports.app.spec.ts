import { test, expect } from "@playwright/test";

/**
 * Reports / "My Hours". Read-only.
 * Covers the tabbed views (My Hours, Activity, Team) and the tax-year PDF
 * control — the area that looked outdated in the old production build.
 */

test.describe("reports", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/reports");
  });

  test("loads the My Hours view", async ({ page }) => {
    await expect(page).toHaveURL(/\/reports/);
    await expect(page.getByRole("heading", { name: /my hours/i })).toBeVisible();
  });

  test("exposes the report tabs", async ({ page }) => {
    // Tab labels render as the heading per active tab; the tab controls exist.
    for (const tab of [/activity/i, /team/i]) {
      await expect(page.getByText(tab).first()).toBeVisible();
    }
  });

  test("switches to the Activity tab", async ({ page }) => {
    await page.getByText(/^activity$/i).first().click();
    await expect(page.getByRole("heading", { name: /activity/i })).toBeVisible();
  });

  test("offers a year selector for the tax/PDF report", async ({ page }) => {
    const currentYear = new Date().getFullYear();
    await expect(
      page.getByText(new RegExp(`${currentYear}`)).first(),
    ).toBeVisible();
  });
});
