-- Transfer team ownership between owner and spouse.
-- SECURITY DEFINER bypasses RLS so the swap is atomic.

CREATE OR REPLACE FUNCTION transfer_team_ownership(new_owner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_owner_id uuid;
  v_old_owner_email text;
  v_caller_id uuid := auth.uid();
  v_new_owner_row_id uuid;
BEGIN
  -- Determine current team owner
  IF EXISTS (SELECT 1 FROM team_members WHERE owner_id = v_caller_id LIMIT 1) THEN
    v_old_owner_id := v_caller_id;
  ELSE
    SELECT tm.owner_id INTO v_old_owner_id
    FROM team_members tm
    WHERE tm.member_id = v_caller_id
      AND tm.role = 'spouse'
      AND tm.status = 'active'
    LIMIT 1;
  END IF;

  IF v_old_owner_id IS NULL THEN
    RAISE EXCEPTION 'You must be the team owner or spouse to transfer ownership';
  END IF;

  IF new_owner_id = v_old_owner_id THEN
    RAISE EXCEPTION 'New owner is already the team owner';
  END IF;

  -- New owner must be an active spouse
  SELECT id INTO v_new_owner_row_id
  FROM team_members
  WHERE owner_id = v_old_owner_id
    AND member_id = new_owner_id
    AND role = 'spouse'
    AND status = 'active';

  IF v_new_owner_row_id IS NULL THEN
    RAISE EXCEPTION 'Ownership can only be transferred to an active spouse';
  END IF;

  SELECT email INTO v_old_owner_email FROM auth.users WHERE id = v_old_owner_id;

  -- 1. Remove new owner's member row (they become implicit owner)
  DELETE FROM team_members WHERE id = v_new_owner_row_id;

  -- 2. Point all remaining members to new owner
  UPDATE team_members SET owner_id = new_owner_id WHERE owner_id = v_old_owner_id;

  -- 3. Add old owner as spouse
  INSERT INTO team_members (owner_id, member_id, email, role, status, joined_at)
  VALUES (new_owner_id, v_old_owner_id, v_old_owner_email, 'spouse', 'active', now());

  -- 4. Transfer properties
  UPDATE properties SET user_id = new_owner_id WHERE user_id = v_old_owner_id;
END;
$$;
