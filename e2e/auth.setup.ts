import { test as setup, expect, type Page } from "@playwright/test";
import path from "node:path";

const authDir = path.join(__dirname, ".auth");

async function login(page: Page, email: string, password: string, file: string) {
  await page.goto("/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await page.context().storageState({ path: file });
}

/**
 * Default session = the owner account. Required for the generic app specs.
 * Set E2E_EMAIL / E2E_PASSWORD to the owner (smoke-test@host-hours.com).
 */
setup("default (owner) session", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "Missing E2E_EMAIL / E2E_PASSWORD (the owner account).\n" +
        "Example: E2E_EMAIL=smoke-test@host-hours.com E2E_PASSWORD=SmokeTest123! npx playwright test",
    );
  }
  await login(page, email, password, path.join(authDir, "user.json"));
});

/**
 * One saved session per non-owner role, used by the role-behavior specs.
 * Each is skipped if its credentials aren't provided, so you can run the
 * suite with any subset of roles configured.
 */
for (const role of ["manager", "helper", "spouse"] as const) {
  setup(`${role} session`, async ({ page }) => {
    const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
    const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
    setup.skip(
      !email || !password,
      `Set E2E_${role.toUpperCase()}_EMAIL / E2E_${role.toUpperCase()}_PASSWORD to test the ${role} role.`,
    );
    await login(page, email!, password!, path.join(authDir, `${role}.json`));
  });
}
