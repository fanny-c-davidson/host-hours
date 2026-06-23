-- Owners aren't rows in team_members (where auto_timer lives), so store their
-- auto-timer preference on the profile. getMyAutoTimer/updateMyAutoTimer fall
-- back to these columns when the user has no active team membership.
alter table profiles
  add column if not exists auto_timer_enabled boolean not null default false,
  add column if not exists default_task text;
