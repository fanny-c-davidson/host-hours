import { expect, type Page } from "@playwright/test";

/**
 * Role permission model (what the specs below assert):
 *
 *   capability         | owner | spouse | manager | helper
 *   -------------------|-------|--------|---------|-------
 *   Plan & billing     |   ✓   |   ✗    |    ✗    |   ✗
 *   Manage team        |   ✓   |   ✓    |    ✓    |   ✗
 *   Auto-timer         |   ✓   |   ✓    |    ✓    |   ✓     (everyone)
 *   IRS target test    |   ✓   |   ✓    |    ✗    |   ✗
 *   Manage properties  |   ✓   |   ✓    |    ✗    |   ✗
 *   Team hours/reports |   ✓   |   ✓    |    ✗    |   ✗
 */
export type RoleCaps = {
  billing: boolean;
  manageTeam: boolean;
  autoTimer: boolean;
  target: boolean;
  manageProperties: boolean;
  teamReports: boolean;
};

export const ROLE_CAPS: Record<"owner" | "spouse" | "manager" | "helper", RoleCaps> = {
  owner:   { billing: true,  manageTeam: true,  autoTimer: true, target: true,  manageProperties: true,  teamReports: true },
  spouse:  { billing: false, manageTeam: true,  autoTimer: true, target: true,  manageProperties: true,  teamReports: true },
  manager: { billing: false, manageTeam: true,  autoTimer: true, target: false, manageProperties: false, teamReports: false },
  helper:  { billing: false, manageTeam: false, autoTimer: true, target: false, manageProperties: false, teamReports: false },
};

async function vis(locator: ReturnType<Page["getByText"]>, shown: boolean) {
  if (shown) await expect(locator.first()).toBeVisible();
  else await expect(locator).toHaveCount(0);
}

/** Settings page — billing / team / auto-timer / target sections per role. */
export async function assertSettings(page: Page, c: RoleCaps) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible();
  await expect(page.getByText(/edit profile/i)).toBeVisible(); // role lookup done

  await vis(page.getByText(/plan & billing/i), c.billing);
  await vis(page.getByText("Manage team", { exact: true }), c.manageTeam);
  await vis(page.getByText(/auto start\/stop/i), c.autoTimer);
  await vis(page.getByText("Target", { exact: true }), c.target); // column label, not "Target & Goal"
}

/** Properties page — "+ Add property" only for owner/spouse. */
export async function assertProperties(page: Page, c: RoleCaps) {
  await page.goto("/properties");
  await expect(page.getByRole("heading", { name: /your properties/i })).toBeVisible();
  await vis(page.getByText(/add property/i), c.manageProperties);
}

/** Reports page — the "Team" tab only for owner/spouse (staff can't see team hours). */
export async function assertReports(page: Page, c: RoleCaps) {
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: /my hours/i })).toBeVisible();
  const teamTab = page.getByRole("link", { name: "Team" });
  if (c.teamReports) await expect(teamTab).toBeVisible();
  else await expect(teamTab).toHaveCount(0);
}

/** Full role assertion across settings, properties, and reports. */
export async function assertRole(page: Page, role: keyof typeof ROLE_CAPS) {
  const c = ROLE_CAPS[role];
  await assertSettings(page, c);
  await assertProperties(page, c);
  await assertReports(page, c);
}
