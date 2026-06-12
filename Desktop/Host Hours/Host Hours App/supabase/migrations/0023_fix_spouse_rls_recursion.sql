-- Fix infinite recursion: policies on team_members cannot subquery team_members.
-- Use a SECURITY DEFINER function to bypass RLS for the spouse check.

CREATE OR REPLACE FUNCTION is_spouse_of_owner(check_owner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE owner_id = check_owner_id
      AND member_id = auth.uid()
      AND role = 'spouse'
      AND status = 'active'
  );
$$;

-- Drop the recursive policies from 0022
DROP POLICY IF EXISTS "Spouses can view team members" ON team_members;
DROP POLICY IF EXISTS "Spouses can insert team members" ON team_members;
DROP POLICY IF EXISTS "Spouses can create invitations" ON invitations;
DROP POLICY IF EXISTS "Spouses can view team property assignments" ON property_assignments;
DROP POLICY IF EXISTS "Spouses can insert team property assignments" ON property_assignments;

-- Recreate using the function (no recursion)
CREATE POLICY "Spouses can view team members"
  ON team_members FOR SELECT USING (
    is_spouse_of_owner(team_members.owner_id)
  );

CREATE POLICY "Spouses can insert team members"
  ON team_members FOR INSERT WITH CHECK (
    is_spouse_of_owner(team_members.owner_id)
  );

CREATE POLICY "Spouses can create invitations"
  ON invitations FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = invitations.team_member_id
        AND is_spouse_of_owner(tm.owner_id)
    )
  );

CREATE POLICY "Spouses can view team property assignments"
  ON property_assignments FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = property_assignments.team_member_id
        AND is_spouse_of_owner(tm.owner_id)
    )
  );

CREATE POLICY "Spouses can insert team property assignments"
  ON property_assignments FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.id = property_assignments.team_member_id
        AND is_spouse_of_owner(tm.owner_id)
    )
  );
