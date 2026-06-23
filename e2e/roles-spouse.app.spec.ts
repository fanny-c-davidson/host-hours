import { test } from "@playwright/test";
import { assertSettingsMatrix } from "./utils";

const hasSpouse = !!(process.env.E2E_SPOUSE_EMAIL && process.env.E2E_SPOUSE_PASSWORD);

/**
 * Spouse role — a co-owner team member. Sees Team + auto-timer, no billing,
 * but UNLIKE staff keeps the IRS target test (a spouse files materially too).
 */
test.use(hasSpouse ? { storageState: "e2e/.auth/spouse.json" } : {});

test.describe("role: spouse", () => {
  test.beforeEach(() =>
    test.skip(!hasSpouse, "Set E2E_SPOUSE_EMAIL / E2E_SPOUSE_PASSWORD to run."),
  );

  test("settings show the spouse layout (team + target, no billing)", async ({ page }) => {
    await assertSettingsMatrix(page, {
      billing: false,
      manageTeam: true,
      autoTimer: true,
      target: true,
    });
  });
});
