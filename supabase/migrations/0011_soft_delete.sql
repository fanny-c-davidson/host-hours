-- ================================================================
-- P1.2 Fix: Soft delete on time_logs and properties
--
-- Problem: deleteProperty() did a hard DELETE which:
--   1. Permanently destroyed billing/tax-relevant time log history
--   2. Cascade-deleted all associated time_logs (unrecoverable)
--
-- Fix: Add deleted_at column to both tables. Deletes set
-- deleted_at = NOW() instead of removing the row. All queries
-- filter WHERE deleted_at IS NULL. Deleted rows are invisible
-- to both app queries and RLS SELECT policies.
-- ================================================================

-- ── time_logs ─────────────────────────────────────────────────────────────

ALTER TABLE public.time_logs
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial index covering only live (non-deleted) rows.
-- This replaces the original idx_time_logs_user_started for all
-- normal queries, and keeps deleted rows out of the index entirely.
CREATE INDEX idx_time_logs_live
  ON public.time_logs(user_id, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_time_logs_property_live
  ON public.time_logs(property_id, started_at DESC)
  WHERE deleted_at IS NULL;

-- Update RLS SELECT policy to exclude soft-deleted rows.
-- Users can still UPDATE their own deleted rows (e.g., restore), but
-- they won't appear in any SELECT query.
DROP POLICY IF EXISTS "time_logs_select_own" ON public.time_logs;
CREATE POLICY "time_logs_select_own" ON public.time_logs
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- ── properties ────────────────────────────────────────────────────────────

ALTER TABLE public.properties
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Partial index: only live, non-archived properties
CREATE INDEX idx_properties_live
  ON public.properties(user_id)
  WHERE deleted_at IS NULL AND is_archived = false;

-- Update RLS SELECT policy to exclude soft-deleted rows
DROP POLICY IF EXISTS "properties_select_own" ON public.properties;
CREATE POLICY "properties_select_own" ON public.properties
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);
