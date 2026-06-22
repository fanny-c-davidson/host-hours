import { test, expect } from "@playwright/test";

/**
 * Timer page. Render checks are read-only; starting a timer writes state and
 * is gated behind E2E_WRITE=1.
 */

const CAN_WRITE = process.env.E2E_WRITE === "1";

test.describe("timer", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/timer");
  });

  test("loads the timer page", async ({ page }) => {
    await expect(page).toHaveURL(/\/timer/);
    // Either a running timer or the start UI shows a task input / Start affordance.
    const hasStart = await page
      .getByText(/start/i)
      .first()
      .isVisible()
      .catch(() => false);
    const hasTaskInput = await page
      .getByPlaceholder(/what did you work on/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasStart || hasTaskInput).toBeTruthy();
  });

  test("start a timer", async ({ page }) => {
    test.skip(!CAN_WRITE, "Set E2E_WRITE=1 to run data-mutating tests.");

    const taskInput = page.getByPlaceholder(/what did you work on/i).first();
    if (await taskInput.isVisible().catch(() => false)) {
      await taskInput.fill(`E2E timer ${Date.now()}`);
    }
    await page.getByRole("button", { name: /start/i }).first().click();

    // A running timer shows an elapsed time in HH:MM:SS form.
    await expect(page.getByText(/\d{2}:\d{2}:\d{2}/).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
