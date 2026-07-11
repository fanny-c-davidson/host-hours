# Host Hours — Mobile (Expo / React Native)

Native iOS + Android app, sharing the **same Supabase backend** as the web app
(`../`). The web app keeps shipping independently; this is a separate native
client, not a wrapper.

## Setup

```bash
cd mobile
npm install
npx expo install   # aligns native module versions to the Expo SDK
cp .env.example .env   # fill EXPO_PUBLIC_SUPABASE_URL + ANON_KEY (same project as web)
```

## Run (dev)

```bash
npx expo start         # then press i / a, or scan the QR in Expo Go for non-native screens
```

> ⚠️ The native features in Phase 3 (background geolocation, push) **don't work
> in Expo Go** — they require a custom dev client built with EAS:
> ```bash
> npx eas build --profile development --platform ios   # (or android)
> ```

## Architecture

- **expo-router** — file-based routing under `app/` (mirrors the web routes).
  - `app/(auth)/` — login/signup (redirects to app when signed in)
  - `app/(app)/` — protected screens (redirects to login when signed out)
- **`src/lib/supabase.ts`** — Supabase client with AsyncStorage session
  persistence (mobile is token-based; the web app uses cookie/SSR auth).
- **`src/lib/auth.tsx`** — `AuthProvider` / `useAuth()` session context.
- **`src/theme/tokens.ts`** — editorial colors + fonts ported from web.

Do **not** import the web app's Next.js server actions here — call Supabase
directly from the client (RLS enforces the same rules).

## Testing the geo auto-timer (real device required)

Background geofencing needs a custom dev client — it cannot run in Expo Go or a
simulator (simulators can fake location, but geofence wakeups are unreliable).

1. `npx eas build --profile development --platform ios` (or `android`), install on device.
2. Sign in, make sure the property has an **address selected from the autocomplete**
   (that's what stores the coordinates; a hand-typed address has none).
3. Settings → enable **Auto start/stop**, grant **Always** location when prompted
   (iOS: Settings → Host Hours → Location → Always, if you missed the prompt).
4. Physically enter/leave the property's 500 m radius (or use a location-spoofing
   dev tool). Expect a "Timer started" notification on arrival and "Timer
   stopped" on departure, and the entry to appear in Recent Activity.
5. Kill the app and repeat — geofence events must still fire (that's the point
   of the background task).

## Status

- [x] Phase 0 — scaffold, Supabase client, theme, auth gate, login + dashboard skeleton
- [x] Phase 1 — full auth (signup, reset, Google), shared UI kit
- [x] Phase 2 — core screens (dashboard, timer, log, reports, properties, settings)
- [x] Phase 3 — native: camera receipts, biometric unlock, push registration, geofence auto-timer
- [x] Phase 4 — brand icons/splash, EAS config, store runbook
- [ ] Phase 5 — web feature parity (property edit, settings sub-screens, export, billing status, team) + push send backend
- [ ] Phase 6 — device QA (geofence walk test), EAS production builds, TestFlight + Play internal, store listings
