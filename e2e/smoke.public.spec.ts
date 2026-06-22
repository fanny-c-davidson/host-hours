import { test, expect } from "@playwright/test";

/**
 * Public smoke tests — no authentication required.
 * These run against any environment (including production, since they don't
 * mutate data) and verify the app is up, the PWA assets ship, and protected
 * routes are gated.
 */

test.describe("public smoke", () => {
  test("landing page loads", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBeLessThan(400);
    // Landing routes into the app: a sign-up CTA and a login CTA.
    await expect(page.locator('a[href="/signup"]').first()).toBeVisible();
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
  });

  test("service worker is served (PWA / offline support)", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("javascript");
    expect(await res.text()).toContain("host-hours");
  });

  test("offline fallback page exists", async ({ request }) => {
    const res = await request.get("/offline.html");
    expect(res.status()).toBe(200);
  });

  test("protected route redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /^sign in$/i })).toBeVisible();
  });

  test("reports route is also gated", async ({ page }) => {
    await page.goto("/reports");
    await expect(page).toHaveURL(/\/login/);
  });
});
