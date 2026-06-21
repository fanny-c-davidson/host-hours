-- Complete spouse team management. Migration 0022 let spouses SELECT and INSERT
-- team members (and 0023 made those non-recursive via is_spouse_of_owner), but
-- the UPDATE/DELETE policies were still owner-only (migration 001) — so a spouse
-- editing a role/email or removing a member silently affected 0 rows under RLS.
--
-- These add the matching UPDATE and DELETE policies for active spouses, so they
-- can manage the team the same way the owner can. Policies are OR'd with the
-- owner policies, so owner access is unchanged.

CREATE POLICY "Spouses can update team members"
  ON team_members FOR UPDATE
  USING (is_spouse_of_owner(team_members.owner_id));

CREATE POLICY "Spouses can delete team members"
  ON team_members FOR DELETE
  USING (is_spouse_of_owner(team_members.owner_id));
