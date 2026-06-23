# Host Hours — E2E tests (Playwright)

End-to-end tests that drive the real app in a browser.

## One-time setup

```bash
npm install
npx playwright install chromium    # downloads the browser
```

> Requires **Node 20+** (the dev server fails silently on Node 18).

## Configure

| Env var            | Purpose                                                        | Default                 |
| ------------------ | ------------------------------------------------------------- | ----------------------- |
| `BASE_URL`         | App under test. Localhost auto-starts `npm run dev`.          | `http://localhost:3000` |
| `E2E_EMAIL`        | Owner account email (required for generic + owner specs).     | —                       |
| `E2E_PASSWORD`     | Owner account password.                                       | —                       |
| `E2E_WRITE`        | Set to `1` to also run data-mutating cases (log hours, timer).| unset (read-only)       |
| `E2E_MANAGER_*`    | Manager account email/password (manager role spec).          | — (spec skips if unset) |
| `E2E_HELPER_*`     | Helper (employee) account (helper role spec).                | — (spec skips if unset) |
| `E2E_SPOUSE_*`     | Spouse account (spouse role spec).                           | — (spec skips if unset) |

Create **dedicated test accounts** in your Supabase project — don't use real
users, and **never point write-tests at production.** Seed all four roles at
once with [`supabase/seed-test-accounts.sql`](../supabase/seed-test-accounts.sql)
(owner + manager + helper + spouse, password `SmokeTest123!`).

## Run

```bash
# Read-only run against local dev (auto-starts the server)
E2E_EMAIL=test@example.com E2E_PASSWORD=secret npm run test:e2e

# Include data-mutating cases
E2E_EMAIL=… E2E_PASSWORD=… E2E_WRITE=1 npm run test:e2e

# Interactive UI mode
npm run test:e2e:ui

# Just the public smoke tests (no account needed) — safe against prod
npx playwright test --project=public

# View the HTML report after a run
npm run test:e2e:report
```

## What's covered

| Spec                       | Project | Auth | Writes | Covers                                           |
| -------------------------- | ------- | ---- | ------ | ------------------------------------------------ |
| `smoke.public.spec.ts`     | public  | no   | no     | app up, `/sw.js` + offline page, protected-route gating |
| `login.public.spec.ts`     | public  | no   | no     | login form renders, invalid-credentials error    |
| `auth.setup.ts`            | setup   | —    | no     | logs in owner + each role, saves their sessions  |
| `dashboard.app.spec.ts`    | app     | yes  | no     | dashboard loads, timer/log entry points          |
| `log.app.spec.ts`          | app     | yes  | opt-in | manual entry form; create entry (`E2E_WRITE=1`)  |
| `timer.app.spec.ts`        | app     | yes  | opt-in | timer page; start timer (`E2E_WRITE=1`)          |
| `reports.app.spec.ts`      | app     | yes  | no     | My Hours / Activity / Team tabs, tax-year selector |
| `settings.app.spec.ts`     | app     | yes  | no     | account section, target & goal, sign-out, edit profile |
| `roles-owner.app.spec.ts`  | app     | yes  | no     | owner: full access (billing, team, target, props, team reports) |
| `roles-manager.app.spec.ts`| app     | mgr  | no     | manager: team + auto-timer; no billing/target/props/team reports |
| `roles-helper.app.spec.ts` | app     | help | no     | helper: auto-timer only; no team/props/target/team reports |
| `roles-spouse.app.spec.ts` | app     | spse | no     | spouse: like owner minus billing |

The four `roles-*` specs assert each role's permission surface across
**Settings**, **Properties**, and **Reports** (see the matrix in `utils.ts`):

| capability | owner | spouse | manager | helper |
|---|:---:|:---:|:---:|:---:|
| Plan & billing | ✓ | ✗ | ✗ | ✗ |
| Manage team | ✓ | ✓ | ✓ | ✗ |
| Auto-timer | ✓ | ✓ | ✓ | ✓ |
| IRS target test | ✓ | ✓ | ✗ | ✗ |
| Manage properties | ✓ | ✓ | ✗ | ✗ |
| Team hours/reports | ✓ | ✓ | ✗ | ✗ |

Each non-owner role spec **skips** unless its `E2E_<ROLE>_*` creds are set.

## Notes

- The `public` project is safe to run against **production** (read-only).
- The `app` + `setup` projects need a real session and should run against
  **local dev or a staging DB**, since `E2E_WRITE=1` creates real rows.
- `e2e/.auth/` (the saved session) is gitignored.
