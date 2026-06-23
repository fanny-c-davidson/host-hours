import { test } from "@playwright/test";
import { assertRole } from "./utils";

/**
 * Owner — uses the default session from auth.setup.ts.
 * Full access: billing, team, auto-timer, IRS target, property management,
 * and team hours/reports.
 */
test.describe("role: owner", () => {
  test("has the owner permission surface", async ({ page }) => {
    await assertRole(page, "owner");
  });
});
