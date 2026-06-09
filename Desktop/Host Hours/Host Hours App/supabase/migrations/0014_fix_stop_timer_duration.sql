-- Fix stop_timer to explicitly set duration_secs.
-- Migration 002 changed duration_secs from a GENERATED column to a regular
-- column, but stop_timer was never updated to compute the value.

CREATE OR REPLACE FUNCTION public.stop_timer(p_timer_id UUID, p_user_id UUID)
RETURNS public.time_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_timer public.active_timers;
  v_log   public.time_logs;
BEGIN
  SELECT * INTO v_timer
  FROM public.active_timers
  WHERE id = p_timer_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Timer not found or not owned by user';
  END IF;

  INSERT INTO public.time_logs
    (user_id, property_id, title, description, category,
     started_at, ended_at, duration_secs, is_billable, source)
  VALUES
    (v_timer.user_id, v_timer.property_id, v_timer.title, v_timer.description,
     v_timer.category, v_timer.started_at, NOW(),
     extract(epoch from (NOW() - v_timer.started_at))::int,
     v_timer.is_billable, v_timer.source)
  RETURNING * INTO v_log;

  DELETE FROM public.active_timers WHERE id = p_timer_id;

  RETURN v_log;
END;
$$;
