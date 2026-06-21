-- Per-member auto-timer config (the data the future native geofencing engine
-- reads). `auto_timer_enabled` toggles auto start/stop on arrival/departure at
-- assigned properties; `default_task` is the task the auto-started timer uses.
alter table team_members
  add column if not exists auto_timer_enabled boolean not null default false,
  add column if not exists default_task text;
