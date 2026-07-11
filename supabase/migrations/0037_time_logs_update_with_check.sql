-- ================================================================
-- Fix: time_logs_update_own is missing an explicit WITH CHECK.
--
-- Migration 0012 added `deleted_at IS NULL` to the USING clause of
-- time_logs_update_own but never added a WITH CHECK. Per Postgres RLS
-- semantics, when WITH CHECK is omitted on an UPDATE policy, the USING
-- expression is reused as WITH CHECK against the *new* row. That means
-- the update that writes deleted_at = NOW() (soft-deleting a time log)
-- fails its own check, since the new row's deleted_at is no longer NULL.
--
-- Migration 0030 already fixed this exact issue for properties_update_own
-- (see its comment) but the same fix was never applied to
-- time_logs_update_own. This migration brings time_logs in line: USING
-- still blocks touching already-deleted rows, WITH CHECK only re-asserts
-- ownership so the soft-delete write itself is allowed.
-- ================================================================

DROP POLICY IF EXISTS "time_logs_update_own" ON public.time_logs;
CREATE POLICY "time_logs_update_own" ON public.time_logs
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);
