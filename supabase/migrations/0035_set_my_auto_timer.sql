-- Lets a signed-in user set their OWN auto-timer prefs from the mobile app
-- (which has no service-role key). Mirrors the web's updateMyAutoTimer: writes
-- the caller's team_members rows if they're a member, otherwise their profile.
create or replace function set_my_auto_timer(p_enabled boolean, p_task text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_task text := nullif(trim(p_task), '');
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from team_members where member_id = v_uid and status = 'active') then
    update team_members
       set auto_timer_enabled = p_enabled, default_task = v_task
     where member_id = v_uid and status = 'active';
  else
    update profiles
       set auto_timer_enabled = p_enabled, default_task = v_task
     where id = v_uid;
  end if;
end;
$$;

grant execute on function set_my_auto_timer(boolean, text) to authenticated;
