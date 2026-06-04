-- Add tax settings columns to profiles
alter table public.profiles
  add column if not exists tax_year int not null default 2026,
  add column if not exists target_test text not null default '500',
  add column if not exists goal_hours int not null default 500;
