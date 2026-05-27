-- ================================================================
-- P1 Fix: Extend soft delete to UPDATE RLS policies
--
-- Problem: Migration 0011 added deleted_at IS NULL to SELECT
-- policies, but UPDATE policies were unchanged. A user could
-- call supabase.from('time_logs').update({deleted_at: null})
-- directly via the JS client (bypassing Server Actions) to
-- undelete or modify soft-deleted rows.
--
-- Fix: Add deleted_at IS NULL to UPDATE policies for both
-- time_logs and properties. Soft-deleted rows become
-- untouchable at the database level — not just in app code.
-- ================================================================

-- ── time_logs ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "time_logs_update_own" ON public.time_logs;
CREATE POLICY "time_logs_update_own" ON public.time_logs
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);

-- ── properties ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "properties_update_own" ON public.properties;
CREATE POLICY "properties_update_own" ON public.properties
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL);
