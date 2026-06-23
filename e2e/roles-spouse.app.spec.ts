import { test } from "@playwright/test";
import { assertRole } from "./utils";

const hasSpouse = !!(process.env.E2E_SPOUSE_EMAIL && process.env.E2E_SPOUSE_PASSWORD);

/**
 * Spouse — co-owner. Like the owner minus billing: manages team + properties,
 * keeps the IRS target test, and sees team hours/reports.
 */
test.use(hasSpouse ? { storageState: "e2e/.auth/spouse.json" } : {});

test.describe("role: spouse", () => {
  test.beforeEach(() =>
    test.skip(!hasSpouse, "Set E2E_SPOUSE_EMAIL / E2E_SPOUSE_PASSWORD to run."),
  );

  test("has the spouse permission surface", async ({ page }) => {
    await assertRole(page, "spouse");
  });
});
