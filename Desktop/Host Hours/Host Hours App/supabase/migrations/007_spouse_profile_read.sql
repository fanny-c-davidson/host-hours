-- Allow linked spouses to read each other's profile
create policy "Linked spouses can view partner profile"
  on profiles for select using (
    exists (
      select 1 from spouse_links
      where status = 'active'
        and (
          (requester_id = auth.uid() and partner_id = profiles.id)
          or (partner_id = auth.uid() and requester_id = profiles.id)
        )
    )
  );

-- Allow linked spouses to read each other's time logs (for combined hours)
create policy "Linked spouses can view partner time logs"
  on time_logs for select using (
    exists (
      select 1 from spouse_links
      where status = 'active'
        and (
          (requester_id = auth.uid() and partner_id = time_logs.user_id)
          or (partner_id = auth.uid() and requester_id = time_logs.user_id)
        )
    )
  );
