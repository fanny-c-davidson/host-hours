-- Owner can read their spouse team member's profile.
-- Mirror of "team_member_profile_select" (which lets members read owner's profile).
CREATE POLICY "owner_can_read_spouse_profile" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.member_id = profiles.id
        AND tm.owner_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'spouse'
    )
  );

-- Owner can read their spouse team member's time logs.
-- Mirror of "team_spouse_time_logs_select" (which lets spouse read owner's logs).
CREATE POLICY "owner_can_read_spouse_time_logs" ON time_logs
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.member_id = time_logs.user_id
        AND tm.owner_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'spouse'
    )
  );
