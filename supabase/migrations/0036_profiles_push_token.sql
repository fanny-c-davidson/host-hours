-- Store the device's Expo push token so the backend can send notifications
-- (timer reminders, team invites). One token per profile is enough for v1.
alter table profiles
  add column if not exists expo_push_token text;
