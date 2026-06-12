-- Allow team members to read their own membership row.
-- Without this, the RLS subqueries on properties/time_logs that join
-- team_members cannot resolve when a member (not the owner) is logged in.

CREATE POLICY "Members can view own membership"
  ON team_members FOR SELECT USING (auth.uid() = member_id);
