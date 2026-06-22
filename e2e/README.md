# Host Hours — E2E tests (Playwright)

End-to-end tests that drive the real app in a browser.

## One-time setup

```bash
npm install
npx playwright install chromium    # downloads the browser
```

> Requires **Node 20+** (the dev server fails silently on Node 18).

## Configure

| Env var        | Purpose                                                           | Default                 |
| -------------- | ---------------------------------------------------------------- | ----------------------- |
| `BASE_URL`     | App under test. Localhost auto-starts `npm run dev`.             | `http://localhost:3000` |
| `E2E_EMAIL`    | Test account email (required for the authenticated specs).        | —                       |
| `E2E_PASSWORD` | Test account password.                                            | —                       |
| `E2E_WRITE`    | Set to `1` to also run data-mutating cases (log hours, timer).    | unset (read-only)       |

Create a **dedicated test account** in your Supabase project — don't use a real
user, and **never point write-tests at production.**

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
| `auth.setup.ts`            | setup   | —    | no     | logs in, saves session for the app specs         |
| `dashboard.app.spec.ts`    | app     | yes  | no     | dashboard loads, timer/log entry points          |
| `log.app.spec.ts`          | app     | yes  | opt-in | manual entry form; create entry (`E2E_WRITE=1`)  |
| `timer.app.spec.ts`        | app     | yes  | opt-in | timer page; start timer (`E2E_WRITE=1`)          |
| `reports.app.spec.ts`      | app     | yes  | no     | My Hours / Activity / Team tabs, tax-year selector |
| `settings.app.spec.ts`     | app     | yes  | no     | account section, target & goal, sign-out, edit profile |

## Notes

- The `public` project is safe to run against **production** (read-only).
- The `app` + `setup` projects need a real session and should run against
  **local dev or a staging DB**, since `E2E_WRITE=1` creates real rows.
- `e2e/.auth/` (the saved session) is gitignored.
