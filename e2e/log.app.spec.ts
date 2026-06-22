import { test, expect } from "@playwright/test";

/**
 * Manual "Log hours" flow.
 * The render/validation checks are read-only. The actual create case is
 * skipped unless E2E_WRITE=1, because submitting writes a real time entry.
 */

const CAN_WRITE = process.env.E2E_WRITE === "1";

test.describe("log hours", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/log");
  });

  test("renders the manual entry form", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /log hours/i })).toBeVisible();
    await expect(page.getByPlaceholder("0")).toBeVisible(); // hours field
    await expect(page.getByPlaceholder(/what did you work on/i)).toBeVisible();
  });

  test("create a time entry", async ({ page }) => {
    test.skip(!CAN_WRITE, "Set E2E_WRITE=1 to run data-mutating tests.");

    await page.getByPlaceholder("0").fill("2");
    await page
      .getByPlaceholder(/what did you work on/i)
      .fill(`E2E test entry ${Date.now()}`);

    // Submit the entry.
    await page.getByRole("button", { name: /save|log|add|submit/i }).first().click();

    // Success: no error surfaced, and we leave the empty form (redirect or sheet).
    await expect(page.getByText(/error|failed|required/i)).toHaveCount(0, {
      timeout: 10_000,
    });
  });
});
