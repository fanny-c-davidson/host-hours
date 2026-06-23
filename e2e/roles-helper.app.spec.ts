import { test } from "@playwright/test";
import { assertRole } from "./utils";

const hasHelper = !!(process.env.E2E_HELPER_EMAIL && process.env.E2E_HELPER_PASSWORD);

/**
 * Helper (team_role = employee) — most restricted. Auto-timer only: no team
 * management, no property management, no billing, no target, no team reports.
 */
test.use(hasHelper ? { storageState: "e2e/.auth/helper.json" } : {});

test.describe("role: helper", () => {
  test.beforeEach(() =>
    test.skip(!hasHelper, "Set E2E_HELPER_EMAIL / E2E_HELPER_PASSWORD to run."),
  );

  test("has the helper permission surface", async ({ page }) => {
    await assertRole(page, "helper");
  });
});
