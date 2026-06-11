-- Phase 2: Team-based RLS policies
-- Adds SELECT/INSERT policies for team members on properties, time_logs, and profiles.
-- These coexist with the existing spouse_links policies until Phase 7 migrates data.
-- Policies are OR'd by Postgres, so either system grants access.

-- ── Properties: team member read access ─────────────────────

-- Cohosts can read ALL of the owner's properties
CREATE POLICY "team_spouse_properties_select" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.owner_id = properties.user_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'spouse'
    )
  );

-- Managers/employees can read only their ASSIGNED properties
CREATE POLICY "team_assigned_properties_select" ON properties
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM property_assignments pa
      JOIN team_members tm ON tm.id = pa.team_member_id
      WHERE pa.property_id = properties.id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role IN ('manager', 'employee')
    )
  );

-- ── Time logs: team member read access ──────────────────────

-- Cohosts can read ALL of the owner's time logs (for combined reports)
CREATE POLICY "team_spouse_time_logs_select" ON time_logs
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.owner_id = time_logs.user_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'spouse'
    )
  );

-- Managers can read time logs for their assigned properties
CREATE POLICY "team_manager_time_logs_select" ON time_logs
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM property_assignments pa
      JOIN team_members tm ON tm.id = pa.team_member_id
      WHERE pa.property_id = time_logs.property_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'manager'
    )
  );

-- ── Time logs: team member write access ─────────────────────

-- Team members with assigned properties can insert their own time logs
-- (user_id must match auth.uid() — they log hours under their own account)
CREATE POLICY "team_member_time_logs_insert" ON time_logs
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM property_assignments pa
      JOIN team_members tm ON tm.id = pa.team_member_id
      WHERE pa.property_id = time_logs.property_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- ── Profiles: team member read access ───────────────────────

-- Active team members can read the profile of the team owner
CREATE POLICY "team_member_profile_select" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.owner_id = profiles.id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- ── Property assignments: team members can view their own ───

CREATE POLICY "Members can view own assignments"
  ON property_assignments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = property_assignments.team_member_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- ── Invitations: invitees can view their pending invitation ─

CREATE POLICY "Invitees can view own invitation"
  ON invitations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = invitations.team_member_id
        AND tm.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
