# Host Hours — Store Build & Submit Runbook (Phase 4)

Step-by-step to get the app onto TestFlight (iOS) and Play internal testing,
then the stores. Run everything from `mobile/`.

## Prerequisites (your accounts)
- **Expo account** — https://expo.dev/signup (free)
- **Apple Developer Program** — $99/yr — https://developer.apple.com/programs/
- **Google Play Developer** — $25 one-time — https://play.google.com/console/signup
- Tools: `npm i -g eas-cli` (or use `npx eas-cli@latest`)

## 0. Link the project to EAS (one time)
```bash
eas login
eas init                 # creates the EAS project, fills extra.eas.projectId in app.json
```
Commit the updated `app.json` after this.

## 1. First development build (test native features on a device)
Camera, biometric, push, and geofence only work in a real build (not Expo Go/web).
```bash
# iOS Simulator build:
eas build --profile development --platform ios
# Android device/emulator:
eas build --profile development --platform android
```
Install the build, then `npx expo start --dev-client` and open it. Test:
- Biometric unlock toggle (Settings) → lock on relaunch
- Attach a receipt on a log entry (camera/library) → appears in R2
- Enable auto-timer (Settings) → grant "Always" location → simulate location at a
  property to confirm the timer auto-starts/stops
- Push: confirm a token is saved to `profiles.expo_push_token`

## 2. Store-ready builds
```bash
eas build --profile production --platform ios       # -> .ipa
eas build --profile production --platform android    # -> .aab
```
EAS will prompt to create/manage signing credentials (let it manage them).

## 3. Submit
```bash
eas submit --platform ios       # uploads to App Store Connect / TestFlight
eas submit --platform android    # uploads to Play Console (internal track)
```
First iOS submit asks for an App Store Connect app — create it at
appstoreconnect.apple.com (bundle id `com.hosthours.app`). First Android submit
needs a Google service-account key (Play Console → Setup → API access).

## 4. Store listing checklist
- **Name:** Host Hours
- **Subtitle/short desc:** Track your hosting hours, IRS-ready.
- **Screenshots:** capture from a device/simulator (dashboard, timer, reports).
  iOS needs 6.7" + 6.5"; Android needs phone screenshots.
- **App icon:** already set (`assets/icon.png`).
- **Privacy policy URL:** REQUIRED — especially for **background location**.
  Apple/Google will reject without a clear disclosure of why location is used
  (auto start/stop the timer at the host's own properties; not shared/sold).
- **Data safety / privacy questionnaire:** declare location (background), and
  that data isn't sold. Account = email.
- **Demo account for review:** give reviewers `smoke-test@host-hours.com` /
  `SmokeTest123!` so they can log in.

## 5. Background-location review note (important)
Both stores scrutinize background location. In the review notes, state:
> Host Hours uses background location solely to automatically start and stop the
> user's own work timer when they arrive at / leave a rental property they manage.
> Location is never shared or sold. The feature is opt-in (off by default).

## Versioning
`eas.json` production profile uses `autoIncrement` for the build number;
bump `expo.version` in `app.json` for user-facing releases (e.g. 1.0.0 → 1.0.1).
