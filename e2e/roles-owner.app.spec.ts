import { test } from "@playwright/test";
import { assertSettingsMatrix } from "./utils";

/**
 * Owner role — uses the default (owner) session from auth.setup.ts.
 * Owners manage billing + team, keep the IRS target test, and have NO
 * auto-timer (that's a team-member feature).
 */
test.describe("role: owner", () => {
  test("settings show the owner-only layout", async ({ page }) => {
    await assertSettingsMatrix(page, {
      billing: true,
      manageTeam: true,
      autoTimer: false,
      target: true,
    });
  });
});
