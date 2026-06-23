import { test } from "@playwright/test";
import { assertRole } from "./utils";

const hasManager = !!(process.env.E2E_MANAGER_EMAIL && process.env.E2E_MANAGER_PASSWORD);

/**
 * Manager — team member with team-management rights but NOT property
 * management, no IRS target test, no billing, and no team hours/reports.
 */
test.use(hasManager ? { storageState: "e2e/.auth/manager.json" } : {});

test.describe("role: manager", () => {
  test.beforeEach(() =>
    test.skip(!hasManager, "Set E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD to run."),
  );

  test("has the manager permission surface", async ({ page }) => {
    await assertRole(page, "manager");
  });
});
