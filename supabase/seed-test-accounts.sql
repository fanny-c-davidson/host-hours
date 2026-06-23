-- ============================================================
-- Host Hours — seed E2E test accounts (owner + manager + helper + spouse)
--
-- Run in Supabase → SQL Editor (or `supabase db execute`). Idempotent:
-- it deletes any prior copies first (cascades to profiles, subscriptions,
-- properties, team_members, etc.) so it's safe to re-run.
--
-- Requires pgcrypto (preinstalled on Supabase). If `crypt`/`gen_salt` aren't
-- found, prefix them with `extensions.` (e.g. extensions.crypt(...)).
--
-- All accounts use password:  SmokeTest123!
--   owner   smoke-test@host-hours.com      (owns the property + the team)
--   manager smoke-manager@host-hours.com   (team_role = manager)
--   helper  smoke-helper@host-hours.com    (team_role = employee)
--   spouse  smoke-spouse@host-hours.com    (team_role = spouse)
-- ============================================================

delete from auth.users where email in (
  'smoke-test@host-hours.com',
  'smoke-manager@host-hours.com',
  'smoke-helper@host-hours.com',
  'smoke-spouse@host-hours.com'
);

-- Session-temporary helper: create an auth user + email identity in one call.
-- (profiles + a free subscription are auto-created by the on_auth_user_created
--  triggers, so we don't insert those here.)
create or replace function pg_temp.mk_test_user(
  p_uid uuid, p_email text, p_name text, p_pass text
) returns void language plpgsql as $fn$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', p_uid, 'authenticated', 'authenticated',
    p_email, crypt(p_pass, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_name), now(), now()
  );
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), p_uid, p_uid::text,
    jsonb_build_object('sub', p_uid::text, 'email', p_email, 'email_verified', true),
    'email', now(), now(), now()
  );
end $fn$;

do $$
declare
  v_owner   uuid := 'aaaaaaaa-0000-4000-8000-000000000001';
  v_helper  uuid := 'aaaaaaaa-0000-4000-8000-000000000002';
  v_manager uuid := 'aaaaaaaa-0000-4000-8000-000000000003';
  v_spouse  uuid := 'aaaaaaaa-0000-4000-8000-000000000004';
  v_prop    uuid;
begin
  perform pg_temp.mk_test_user(v_owner,   'smoke-test@host-hours.com',    'Smoke Test Owner', 'SmokeTest123!');
  perform pg_temp.mk_test_user(v_helper,  'smoke-helper@host-hours.com',  'Smoke Helper',     'SmokeTest123!');
  perform pg_temp.mk_test_user(v_manager, 'smoke-manager@host-hours.com', 'Smoke Manager',    'SmokeTest123!');
  perform pg_temp.mk_test_user(v_spouse,  'smoke-spouse@host-hours.com',  'Smoke Spouse',     'SmokeTest123!');

  -- Owner on a paid plan so timer / team / export features are usable.
  update subscriptions set tier_id = 'professional' where user_id = v_owner;

  -- A property owned by the owner (needed: time_logs require a property_id).
  insert into properties (user_id, name, address, color, latitude, longitude)
  values (v_owner, 'Smoke Test Cabin', '123 Test St, Austin, TX', '#4A148C', 30.2672, -97.7431)
  returning id into v_prop;

  -- Team members under the owner, all active.
  insert into team_members (owner_id, member_id, email, role, status, first_name, last_name, joined_at)
  values
    (v_owner, v_helper,  'smoke-helper@host-hours.com',  'employee', 'active', 'Smoke', 'Helper',  now()),
    (v_owner, v_manager, 'smoke-manager@host-hours.com', 'manager',  'active', 'Smoke', 'Manager', now()),
    (v_owner, v_spouse,  'smoke-spouse@host-hours.com',  'spouse',   'active', 'Smoke', 'Spouse',  now());

  -- Assign staff (helper + manager) to the property so they can log against it.
  insert into property_assignments (team_member_id, property_id)
  select tm.id, v_prop
    from team_members tm
   where tm.owner_id = v_owner and tm.role in ('employee', 'manager');
end $$;

-- Quick verification:
-- select u.email, s.tier_id, tm.role, tm.status
--   from auth.users u
--   left join subscriptions s on s.user_id = u.id
--   left join team_members tm on tm.member_id = u.id
--  where u.email like 'smoke-%@host-hours.com'
--  order by u.email;
