-- Phase 7: Migrate active spouse_links into team_members as cohosts.
-- Creates BIDIRECTIONAL cohost memberships (A→B and B→A) so both
-- spouses see each other's hours in combined reports.
-- Then drops the spouse-specific RLS policies and helper functions.

-- ── Migrate active spouse links to cohost team members ──────

-- Direction 1: requester owns, partner is cohost
INSERT INTO team_members (owner_id, member_id, email, role, status, joined_at)
SELECT
  sl.requester_id,
  sl.partner_id,
  p.email,
  'spouse'::team_role,
  'active'::team_member_status,
  now()
FROM spouse_links sl
JOIN profiles p ON p.id = sl.partner_id
WHERE sl.status = 'active'
  AND sl.partner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.owner_id = sl.requester_id
      AND tm.member_id = sl.partner_id
  );

-- Direction 2: partner owns, requester is cohost
INSERT INTO team_members (owner_id, member_id, email, role, status, joined_at)
SELECT
  sl.partner_id,
  sl.requester_id,
  p.email,
  'spouse'::team_role,
  'active'::team_member_status,
  now()
FROM spouse_links sl
JOIN profiles p ON p.id = sl.requester_id
WHERE sl.status = 'active'
  AND sl.partner_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.owner_id = sl.partner_id
      AND tm.member_id = sl.requester_id
  );

-- ── Drop spouse-specific RLS policies ───────────────────────

DROP POLICY IF EXISTS "Users can read linked spouse properties" ON properties;
DROP POLICY IF EXISTS "Linked spouses can view partner profile" ON profiles;
DROP POLICY IF EXISTS "Linked spouses can view partner time logs" ON time_logs;
DROP POLICY IF EXISTS "Users can view own spouse links" ON spouse_links;
DROP POLICY IF EXISTS "Users can view pending invites to them" ON spouse_links;
DROP POLICY IF EXISTS "Users can create spouse links" ON spouse_links;
DROP POLICY IF EXISTS "Partner can accept invite" ON spouse_links;
DROP POLICY IF EXISTS "Either side can unlink" ON spouse_links;

-- ── Drop spouse helper functions ────────────────────────────

DROP FUNCTION IF EXISTS is_linked_spouse(uuid);
DROP FUNCTION IF EXISTS get_my_email();

-- ── Note: spouse_links table is kept for now (historical data) ──
-- A future migration can drop it once UI references are fully removed.
