-- ================================================================
-- P2 Fix: stop_timer SECURITY DEFINER missing SET search_path
--
-- Problem: SECURITY DEFINER functions run with the privileges of
-- the function owner (typically the postgres superuser role).
-- Without an explicit SET search_path, a database user who can
-- CREATE SCHEMA could shadow public tables by creating a schema
-- with the same table names earlier in the search path, redirecting
-- the function's table references to their own schema.
--
-- Fix: pin search_path = public so table references are always
-- resolved to the public schema, regardless of the session's
-- search_path setting.
-- ================================================================

CREATE OR REPLACE FUNCTION public.stop_timer(p_timer_id UUID, p_user_id UUID)
RETURNS public.time_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public    -- prevents search_path injection
AS $$
DECLARE
  v_timer public.active_timers;
  v_log   public.time_logs;
BEGIN
  -- Lock the row to prevent concurrent stop requests on the same timer.
  -- The second concurrent call blocks here until the first commits,
  -- then finds no row (it was deleted) and raises the exception below.
  SELECT * INTO v_timer
  FROM public.active_timers
  WHERE id = p_timer_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timer not found or not owned by user';
  END IF;

  -- duration_secs is GENERATED ALWAYS AS (ended_at - started_at),
  -- so it is computed automatically from NOW() — no client clock used.
  INSERT INTO public.time_logs
    (user_id, property_id, title, description, category,
     started_at, ended_at, is_billable, source)
  VALUES
    (v_timer.user_id, v_timer.property_id, v_timer.title, v_timer.description,
     v_timer.category, v_timer.started_at, NOW(), v_timer.is_billable, v_timer.source)
  RETURNING * INTO v_log;

  DELETE FROM public.active_timers WHERE id = p_timer_id;

  RETURN v_log;
END;
$$;
