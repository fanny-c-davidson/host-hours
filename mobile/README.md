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

## Status

- [x] Phase 0 — scaffold, Supabase client, theme, auth gate, login + dashboard skeleton
- [ ] Phase 1 — full auth (signup, reset, Google), polish
- [ ] Phase 2 — core screens (dashboard, timer, log, reports, properties, settings)
- [ ] Phase 3 — native: camera, biometric, push, geofence auto-timer
- [ ] Phase 4 — icons/splash, EAS builds, TestFlight + Play internal, store listings
