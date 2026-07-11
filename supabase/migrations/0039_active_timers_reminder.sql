-- Track when the "timer still running" push reminder was sent for an active
-- timer, so the cron sender reminds once per timer instead of every run.
alter table active_timers
  add column if not exists reminder_sent_at timestamptz;
