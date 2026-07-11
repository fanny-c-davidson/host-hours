-- ================================================================
-- Security fix: spouse role/owner escalation via team_members UPDATE
--
-- "Spouses can update team members" (0031) has no WITH CHECK, so an
-- active spouse's own session (calling Supabase directly, bypassing
-- the app's server actions) could update ANY column on a team_members
-- row belonging to their household team -- including `role` (e.g.
-- promoting an employee to 'spouse', the highest-access role in this
-- system) or `owner_id`.
--
-- The app itself never does this via the RLS-bound client -- team.ts
-- always uses the service-role client for team_members writes -- so
-- this is a defense-in-depth fix for anyone hitting the Supabase API
-- directly with a valid spouse session token.
--
-- A BEFORE UPDATE trigger (not just a policy) is used because an RLS
-- WITH CHECK clause can only see the new row, not compare it to the
-- old one. Service-role writes (auth.uid() IS NULL) are left
-- untouched -- they're already authorized by the application layer.
-- ================================================================

CREATE OR REPLACE FUNCTION public.prevent_unauthorized_team_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    -- Service-role / backend write; already authorized by the app.
    RETURN NEW;
  END IF;

  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.owner_id IS DISTINCT FROM OLD.owner_id)
     AND auth.uid() IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'Only the team owner can change a member''s role or owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unauthorized_team_role_change ON public.team_members;
CREATE TRIGGER trg_prevent_unauthorized_team_role_change
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_unauthorized_team_role_change();
