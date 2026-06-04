-- ================================================================
-- P0.1 Fix: Webhook idempotency — add status column
--
-- Problem: The old approach inserted the event record first, then
-- processed. If processing failed, Stripe would retry but the
-- duplicate-key check would return 200 immediately — silently
-- dropping the retry. A failed checkout.session.completed meant
-- the user paid but their subscription was never activated.
--
-- Fix: status-based idempotency. Only skip events with
-- status = 'processed'. Events with status = 'failed' or
-- 'pending' are re-processed on Stripe retry.
-- ================================================================

ALTER TABLE public.webhook_events
  ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'processed', 'failed'));

-- Backfill existing rows: if processed_at is set, mark as processed
UPDATE public.webhook_events
  SET status = CASE
    WHEN processed_at IS NOT NULL AND error IS NULL THEN 'processed'
    WHEN error IS NOT NULL                           THEN 'failed'
    ELSE 'pending'
  END;

-- Index for fast idempotency lookup (stripe_event_id is UNIQUE,
-- but including status allows an index-only scan)
CREATE INDEX idx_webhook_events_idempotency
  ON public.webhook_events(stripe_event_id, status);
