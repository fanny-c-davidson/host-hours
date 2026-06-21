-- Allow users to read properties belonging to their linked spouse.
-- This enables the reports page to show property names and addresses
-- when combining hours with a spouse.

CREATE POLICY "Users can read linked spouse properties"
ON properties FOR SELECT
USING (
  user_id IN (
    SELECT partner_id FROM spouse_links WHERE requester_id = auth.uid() AND status = 'active'
    UNION ALL
    SELECT requester_id FROM spouse_links WHERE partner_id = auth.uid() AND status = 'active'
  )
);
