-- 009: Timer persistence support
-- 1. Change category columns from enum to text (supports multi-category entries)
-- 2. Add UNIQUE(user_id) on active_timers (one timer per user)
-- 3. Add UPDATE policy on active_timers (for editing metadata while timer runs)

-- Change category to text on both tables
alter table active_timers alter column category type text using category::text;
alter table active_timers alter column category set default 'other';

alter table time_logs alter column category type text using category::text;
alter table time_logs alter column category set default 'other';

-- One timer per user
do $$ begin
  alter table active_timers add constraint active_timers_user_id_key unique (user_id);
exception when duplicate_object then null;
end $$;

-- UPDATE policy so users can edit timer metadata while it runs
create policy "Users can update own timers"
  on active_timers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
