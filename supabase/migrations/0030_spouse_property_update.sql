-- Co-hosts (spouses) can fully manage the owner's properties — edit any detail
-- and soft-delete — matching their read access (0017) and the owner's own
-- abilities. Managers/employees stay read-only.
--
-- Both policies use an EXPLICIT WITH CHECK so soft-delete works:
--   USING      restricts targets to non-deleted rows (you can't touch an
--              already-deleted property, preventing un-delete/modify).
--   WITH CHECK enforces only ownership/membership on the new row, so setting
--              deleted_at is allowed and a co-host can't reassign a property
--              to an owner they don't co-host.
-- (The previous owner policy, 0012, omitted WITH CHECK, so it defaulted to the
--  USING expression — which includes `deleted_at IS NULL` — and silently
--  blocked soft-delete of the row itself.)

-- ── Owner: edit + soft-delete own properties ────────────────────────────────
DROP POLICY IF EXISTS "properties_update_own" ON public.properties;
CREATE POLICY "properties_update_own" ON public.properties
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- ── Co-host (spouse): edit + soft-delete the owner's properties ──────────────
DROP POLICY IF EXISTS "team_spouse_properties_update" ON public.properties;
CREATE POLICY "team_spouse_properties_update" ON public.properties
  FOR UPDATE
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.owner_id = properties.user_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'spouse'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.owner_id = properties.user_id
        AND tm.member_id = auth.uid()
        AND tm.status = 'active'
        AND tm.role = 'spouse'
    )
  );
