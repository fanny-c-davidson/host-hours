-- Helper: check if current user has an active spouse link with a given user (bypasses RLS)
create or replace function is_linked_spouse(target_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from spouse_links
    where status = 'active'
      and (
        (requester_id = auth.uid() and partner_id = target_user_id)
        or (partner_id = auth.uid() and requester_id = target_user_id)
      )
  );
$$;

-- Allow linked spouses to read each other's profile
create policy "Linked spouses can view partner profile"
  on profiles for select using (
    is_linked_spouse(profiles.id)
  );

-- Allow linked spouses to read each other's time logs (for combined hours)
create policy "Linked spouses can view partner time logs"
  on time_logs for select using (
    is_linked_spouse(time_logs.user_id)
  );
