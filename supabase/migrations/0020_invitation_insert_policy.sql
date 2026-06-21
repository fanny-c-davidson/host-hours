-- Allow team owners to create invitations for their team members.
-- The original schema only had a SELECT policy on invitations.

CREATE POLICY "Owners can create invitations"
  ON invitations FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = invitations.team_member_id
        AND tm.owner_id = auth.uid()
    )
  );
