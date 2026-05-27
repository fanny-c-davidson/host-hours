-- ============================================================
-- Host Hours — Task Types + Category Fixes
-- Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Create task_types table
create table task_types (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

alter table task_types enable row level security;

create policy "Users can view own task types"
  on task_types for select using (auth.uid() = user_id);

create policy "Users can insert own task types"
  on task_types for insert with check (auth.uid() = user_id);

create policy "Users can delete own task types"
  on task_types for delete using (auth.uid() = user_id);

create index idx_task_types_user on task_types(user_id);

-- 2. Change category columns from enum to text
alter table time_logs alter column category type text using category::text;
alter table time_logs alter column category set default 'other';

alter table active_timers alter column category type text using category::text;
alter table active_timers alter column category set default 'other';

drop type time_log_category;

-- 3. Fix time_logs: drop generated duration_secs and recreate as regular column
--    Also add a notes column for convenience
alter table time_logs drop column duration_secs;
alter table time_logs add column duration_secs int not null default 0;
alter table time_logs alter column ended_at drop not null;

-- 4. Seed default task types for all existing users
insert into task_types (user_id, name, sort_order)
select u.id, t.name, t.sort_order
from auth.users u
cross join (values
  ('Booking Mgmt', 0),
  ('Listing Optimization', 1),
  ('Guest Communications', 2),
  ('Marketing', 3),
  ('Cleaning', 4),
  ('Vendor Communications', 5),
  ('Landscaping', 6),
  ('Restocking', 7),
  ('Inspection', 8),
  ('Hands-on Repairs', 9),
  ('On-Site Vendor Supervision', 10)
) as t(name, sort_order)
on conflict do nothing;

-- 5. Update signup trigger to also seed task types for new users
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );

  insert into public.task_types (user_id, name, sort_order)
  values
    (new.id, 'Booking Mgmt', 0),
    (new.id, 'Listing Optimization', 1),
    (new.id, 'Guest Communications', 2),
    (new.id, 'Marketing', 3),
    (new.id, 'Cleaning', 4),
    (new.id, 'Vendor Communications', 5),
    (new.id, 'Landscaping', 6),
    (new.id, 'Restocking', 7),
    (new.id, 'Inspection', 8),
    (new.id, 'Hands-on Repairs', 9),
    (new.id, 'On-Site Vendor Supervision', 10);

  return new;
end;
$$ language plpgsql security definer;
