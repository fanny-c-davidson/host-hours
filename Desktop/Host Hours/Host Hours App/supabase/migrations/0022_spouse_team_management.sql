-- Allow spouses to manage the team: view all members, invite, and create invitations.

-- Spouses can view all members on their team
CREATE POLICY "Spouses can view team members"
  ON team_members FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members spouse
      WHERE spouse.owner_id = team_members.owner_id
        AND spouse.member_id = auth.uid()
        AND spouse.status = 'active'
        AND spouse.role = 'spouse'
    )
  );

-- Spouses can add members to their team
CREATE POLICY "Spouses can insert team members"
  ON team_members FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members spouse
      WHERE spouse.owner_id = team_members.owner_id
        AND spouse.member_id = auth.uid()
        AND spouse.status = 'active'
        AND spouse.role = 'spouse'
    )
  );

-- Spouses can create invitations for their team's members
CREATE POLICY "Spouses can create invitations"
  ON invitations FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN team_members spouse ON spouse.owner_id = tm.owner_id
      WHERE tm.id = invitations.team_member_id
        AND spouse.member_id = auth.uid()
        AND spouse.status = 'active'
        AND spouse.role = 'spouse'
    )
  );

-- Spouses can view property assignments for their team
CREATE POLICY "Spouses can view team property assignments"
  ON property_assignments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN team_members spouse ON spouse.owner_id = tm.owner_id
      WHERE tm.id = property_assignments.team_member_id
        AND spouse.member_id = auth.uid()
        AND spouse.status = 'active'
        AND spouse.role = 'spouse'
    )
  );

-- Spouses can assign properties to team members
CREATE POLICY "Spouses can insert team property assignments"
  ON property_assignments FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN team_members spouse ON spouse.owner_id = tm.owner_id
      WHERE tm.id = property_assignments.team_member_id
        AND spouse.member_id = auth.uid()
        AND spouse.status = 'active'
        AND spouse.role = 'spouse'
    )
  );
