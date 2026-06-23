import { test } from "@playwright/test";
import { assertSettingsMatrix } from "./utils";

const hasHelper = !!(process.env.E2E_HELPER_EMAIL && process.env.E2E_HELPER_PASSWORD);

/**
 * Helper role (team_role = employee) — the most restricted team member.
 * No billing, NO Team section (can't manage team), has auto-timer, and no
 * IRS target test.
 */
test.use(hasHelper ? { storageState: "e2e/.auth/helper.json" } : {});

test.describe("role: helper", () => {
  test.beforeEach(() =>
    test.skip(!hasHelper, "Set E2E_HELPER_EMAIL / E2E_HELPER_PASSWORD to run."),
  );

  test("settings show the helper layout (no team management)", async ({ page }) => {
    await assertSettingsMatrix(page, {
      billing: false,
      manageTeam: false,
      autoTimer: true,
      target: false,
    });
  });
});
