-- ============================================================
-- Host Hours — Initial Schema
-- Run this in the Supabase SQL Editor (supabase.com > your project > SQL Editor)
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────

create type subscription_status as enum (
  'trialing', 'active', 'incomplete', 'incomplete_expired',
  'past_due', 'canceled', 'unpaid', 'paused'
);

create type time_log_category as enum (
  'cleaning', 'maintenance', 'guest_communication', 'admin',
  'inspection', 'staging', 'other'
);

create type team_role as enum ('manager', 'employee');

create type team_member_status as enum ('pending', 'active', 'suspended');

-- ── Profiles ─────────────────────────────────────────────────

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  timezone    text not null default 'America/New_York',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Subscription Tiers (reference data) ──────────────────────

create table subscription_tiers (
  id                      text primary key,
  display_name            text not null,
  max_properties          int,
  has_live_timer           boolean not null default false,
  has_csv_export           boolean not null default false,
  has_geo_autostart        boolean not null default false,
  has_team_members         boolean not null default false,
  monthly_price_cents      int not null default 0,
  yearly_price_cents       int not null default 0,
  stripe_monthly_price_id  text,
  stripe_yearly_price_id   text,
  is_active                boolean not null default true,
  sort_order               int not null default 0
);

alter table subscription_tiers enable row level security;

create policy "Anyone can read tiers"
  on subscription_tiers for select using (true);

-- Seed tiers
insert into subscription_tiers (id, display_name, max_properties, has_live_timer, has_csv_export, has_geo_autostart, has_team_members, monthly_price_cents, yearly_price_cents, sort_order)
values
  ('free',         'Free',          1,    false, false, false, false, 0,    0,    0),
  ('professional', 'Professional',  5,    true,  true,  true,  true,  1999, 19190, 1),
  ('enterprise',   'Enterprise',    null, true,  true,  true,  true,  4999, 47990, 2);

-- ── Subscriptions ────────────────────────────────────────────

create table subscriptions (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  tier_id                 text references subscription_tiers(id),
  stripe_customer_id      text,
  stripe_subscription_id  text,
  stripe_price_id         text,
  status                  subscription_status default 'active',
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  cancel_at_period_end    boolean not null default false,
  trial_end               timestamptz,
  canceled_at             timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique(user_id)
);

alter table subscriptions enable row level security;

create policy "Users can view own subscription"
  on subscriptions for select using (auth.uid() = user_id);

-- Auto-create free subscription on signup
create or replace function handle_new_subscription()
returns trigger as $$
begin
  insert into public.subscriptions (user_id, tier_id, status)
  values (new.id, 'free', 'active');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function handle_new_subscription();

-- ── Properties ───────────────────────────────────────────────

create table properties (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  address           text,
  description       text,
  color             text not null default '#4A148C',
  latitude          double precision,
  longitude         double precision,
  geo_radius_meters int not null default 200,
  is_archived       boolean not null default false,
  archived_at       timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table properties enable row level security;

create policy "Users can view own properties"
  on properties for select using (auth.uid() = user_id);

create policy "Users can insert own properties"
  on properties for insert with check (auth.uid() = user_id);

create policy "Users can update own properties"
  on properties for update using (auth.uid() = user_id);

create policy "Users can delete own properties"
  on properties for delete using (auth.uid() = user_id);

-- ── Time Logs ────────────────────────────────────────────────

create table time_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  property_id     uuid not null references properties(id) on delete cascade,
  title           text not null,
  description     text,
  category        time_log_category not null default 'other',
  started_at      timestamptz not null,
  ended_at        timestamptz not null,
  duration_secs   int generated always as (extract(epoch from (ended_at - started_at))::int) stored,
  is_billable     boolean not null default true,
  source          text not null default 'manual',
  deleted_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table time_logs enable row level security;

create policy "Users can view own time logs"
  on time_logs for select using (auth.uid() = user_id);

create policy "Users can insert own time logs"
  on time_logs for insert with check (auth.uid() = user_id);

create policy "Users can update own time logs"
  on time_logs for update using (auth.uid() = user_id);

create policy "Users can delete own time logs"
  on time_logs for delete using (auth.uid() = user_id);

-- ── Active Timers ────────────────────────────────────────────

create table active_timers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  property_id   uuid not null references properties(id) on delete cascade,
  title         text not null,
  description   text,
  category      time_log_category not null default 'other',
  is_billable   boolean not null default true,
  started_at    timestamptz not null default now(),
  source        text not null default 'web',
  created_at    timestamptz not null default now()
);

alter table active_timers enable row level security;

create policy "Users can view own timers"
  on active_timers for select using (auth.uid() = user_id);

create policy "Users can insert own timers"
  on active_timers for insert with check (auth.uid() = user_id);

create policy "Users can delete own timers"
  on active_timers for delete using (auth.uid() = user_id);

-- Stop timer function: moves active_timer → time_logs
create or replace function stop_timer(p_timer_id uuid, p_user_id uuid)
returns time_logs as $$
declare
  v_timer active_timers;
  v_log   time_logs;
begin
  select * into v_timer from active_timers
    where id = p_timer_id and user_id = p_user_id;

  if not found then
    raise exception 'Timer not found';
  end if;

  insert into time_logs (user_id, property_id, title, description, category, started_at, ended_at, is_billable, source)
  values (v_timer.user_id, v_timer.property_id, v_timer.title, v_timer.description, v_timer.category, v_timer.started_at, now(), v_timer.is_billable, v_timer.source)
  returning * into v_log;

  delete from active_timers where id = p_timer_id;

  return v_log;
end;
$$ language plpgsql security definer;

-- ── Team Members ─────────────────────────────────────────────

create table team_members (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  member_id   uuid references auth.users(id) on delete set null,
  email       text not null,
  role        team_role not null,
  status      team_member_status not null default 'pending',
  invited_at  timestamptz not null default now(),
  joined_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table team_members enable row level security;

create policy "Owners can view own team"
  on team_members for select using (auth.uid() = owner_id);

create policy "Owners can manage own team"
  on team_members for insert with check (auth.uid() = owner_id);

create policy "Owners can update own team"
  on team_members for update using (auth.uid() = owner_id);

create policy "Owners can remove team members"
  on team_members for delete using (auth.uid() = owner_id);

-- ── Property Assignments ─────────────────────────────────────

create table property_assignments (
  id              uuid primary key default gen_random_uuid(),
  team_member_id  uuid not null references team_members(id) on delete cascade,
  property_id     uuid not null references properties(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique(team_member_id, property_id)
);

alter table property_assignments enable row level security;

create policy "Owners can view assignments"
  on property_assignments for select using (
    exists (select 1 from team_members tm where tm.id = team_member_id and tm.owner_id = auth.uid())
  );

create policy "Owners can manage assignments"
  on property_assignments for insert with check (
    exists (select 1 from team_members tm where tm.id = team_member_id and tm.owner_id = auth.uid())
  );

create policy "Owners can delete assignments"
  on property_assignments for delete using (
    exists (select 1 from team_members tm where tm.id = team_member_id and tm.owner_id = auth.uid())
  );

-- ── Invitations ──────────────────────────────────────────────

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  team_member_id  uuid not null references team_members(id) on delete cascade,
  token           uuid not null default gen_random_uuid(),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  used_at         timestamptz,
  created_at      timestamptz not null default now(),
  unique(token)
);

alter table invitations enable row level security;

create policy "Owners can view own invitations"
  on invitations for select using (
    exists (select 1 from team_members tm where tm.id = team_member_id and tm.owner_id = auth.uid())
  );

-- ── Webhook Events (Stripe) ─────────────────────────────────

create table webhook_events (
  id              uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type      text not null,
  payload         jsonb not null,
  status          text not null default 'pending',
  processed_at    timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);

alter table webhook_events enable row level security;

-- ── Indexes ──────────────────────────────────────────────────

create index idx_properties_user on properties(user_id) where deleted_at is null;
create index idx_time_logs_user on time_logs(user_id) where deleted_at is null;
create index idx_time_logs_property on time_logs(property_id) where deleted_at is null;
create index idx_time_logs_started on time_logs(started_at desc) where deleted_at is null;
create index idx_active_timers_user on active_timers(user_id);
create index idx_subscriptions_user on subscriptions(user_id);
create index idx_team_members_owner on team_members(owner_id);

-- ── Updated-at trigger ───────────────────────────────────────

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at
  before update on profiles for each row execute function set_updated_at();

create trigger set_properties_updated_at
  before update on properties for each row execute function set_updated_at();

create trigger set_time_logs_updated_at
  before update on time_logs for each row execute function set_updated_at();

create trigger set_subscriptions_updated_at
  before update on subscriptions for each row execute function set_updated_at();

create trigger set_team_members_updated_at
  before update on team_members for each row execute function set_updated_at();
