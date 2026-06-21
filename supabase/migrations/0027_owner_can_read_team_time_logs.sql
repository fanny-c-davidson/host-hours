-- Owner can read time logs of ALL active team members (not just spouse).
-- Enables the Team tab on reports to show hours per team member.
CREATE POLICY "owner_can_read_team_member_time_logs" ON time_logs
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.member_id = time_logs.user_id
        AND tm.owner_id = auth.uid()
        AND tm.status = 'active'
    )
  );
