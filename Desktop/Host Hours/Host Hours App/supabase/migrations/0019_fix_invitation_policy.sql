-- Fix: replace auth.users query with auth.email() in invitation policy.
-- The authenticated role cannot SELECT from auth.users directly.

DROP POLICY IF EXISTS "Invitees can view own invitation" ON invitations;

CREATE POLICY "Invitees can view own invitation"
  ON invitations FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = invitations.team_member_id
        AND tm.email = auth.email()
    )
  );
