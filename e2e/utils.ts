import { expect, type Page } from "@playwright/test";

/**
 * The Settings page renders a distinct combination of sections per user role.
 * Each role has a unique signature, so asserting these four toggles pins down
 * role-specific behavior deterministically (no seeded activity required):
 *
 *   role     | Plan & billing | Manage team | Auto-timer | Target column
 *   ---------|----------------|-------------|------------|---------------
 *   owner    |       ✓        |      ✓      |     ✗      |      ✓
 *   manager  |       ✗        |      ✓      |     ✓      |      ✗
 *   helper   |       ✗        |      ✗      |     ✓      |      ✗
 *   spouse   |       ✗        |      ✓      |     ✓      |      ✓
 *
 * - Plan & billing: owners only (`!isTeamMember`).
 * - Manage team: hidden only for helpers (employee role).
 * - Auto-timer card: any team member (manager / helper / spouse).
 * - Target column: hidden for "staff" (manager + helper); owners & spouses
 *   keep the IRS target test.
 */
export type SettingsMatrix = {
  billing: boolean;
  manageTeam: boolean;
  autoTimer: boolean;
  target: boolean;
};

export async function assertSettingsMatrix(page: Page, m: SettingsMatrix) {
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: /^settings$/i })).toBeVisible();
  // Wait for the client-side role lookup to finish (account section always renders).
  await expect(page.getByText(/edit profile/i)).toBeVisible();

  const billing = page.getByText(/plan & billing/i);
  const manageTeam = page.getByText("Manage team", { exact: true });
  const autoTimer = page.getByText(/auto start\/stop/i);
  const target = page.getByText("Target", { exact: true }); // column label, not "Target & Goal"

  if (m.billing) await expect(billing).toBeVisible();
  else await expect(billing).toHaveCount(0);

  if (m.manageTeam) await expect(manageTeam).toBeVisible();
  else await expect(manageTeam).toHaveCount(0);

  if (m.autoTimer) await expect(autoTimer).toBeVisible();
  else await expect(autoTimer).toHaveCount(0);

  if (m.target) await expect(target).toBeVisible();
  else await expect(target).toHaveCount(0);
}
