import { test } from "@playwright/test";
import { assertSettingsMatrix } from "./utils";

const hasManager = !!(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

/**
 * Manager role — a team member with elevated permissions.
 * Sees Team + auto-timer, no billing, and (as "staff") no IRS target test.
 */
test.use(hasManager ? { storageState: "e2e/.auth/manager.json" } : {});

test.describe("role: manager", () => {
  test.beforeEach(() =>
    test.skip(!hasManager, "Set E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD to run."),
  );

  test("settings show the manager layout", async ({ page }) => {
    await assertSettingsMatrix(page, {
      billing: false,
      manageTeam: true,
      autoTimer: true,
      target: false,
    });
  });
});
