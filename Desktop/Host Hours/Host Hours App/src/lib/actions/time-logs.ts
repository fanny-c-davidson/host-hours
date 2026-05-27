'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, UNAUTHORIZED } from '@/lib/actions/_helpers';
import { requireFeature, SubscriptionError } from '@/lib/subscriptions';
import { getPropertyById } from '@/lib/queries/properties';
import { getTimeLogById } from '@/lib/queries/time-logs';
import { StartTimerSchema, CreateTimeLogSchema, UpdateTimeLogSchema } from '@/lib/validations/time-log';
import type { ActionResult, ActiveTimer, TimeLog } from '@/types/app';

// ── MANUAL TIME LOG ────────────────────────────────────────────────────────

export async function createTimeLog(input: unknown): Promise<ActionResult<TimeLog>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    const parsed = CreateTimeLogSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const property = await getPropertyById(parsed.data.property_id, user.id);
    if (!property) return { data: null, error: 'Property not found.' };

    const supabase = await createClient();
    // duration_secs is GENERATED ALWAYS AS — omit it from insert
    const { data, error } = await supabase
      .from('time_logs')
      .insert({
        user_id:     user.id,
        property_id: parsed.data.property_id,
        title:       parsed.data.title,
        description: parsed.data.description,
        category:    parsed.data.category,
        started_at:  parsed.data.started_at,
        ended_at:    parsed.data.ended_at,
        is_billable: parsed.data.is_billable,
        source:      'manual',
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath('/time');
    revalidatePath('/dashboard');
    return { data, error: null };

  } catch (err) {
    if (err instanceof SubscriptionError) return { data: null, error: err.message };
    return { data: null, error: 'Unexpected error.' };
  }
}

// ── START TIMER ────────────────────────────────────────────────────────────

export async function startTimer(input: unknown): Promise<ActionResult<ActiveTimer>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    // Server-side plan gate — live timer is Pro+ only
    await requireFeature(user.id, 'hasLiveTimer');

    const parsed = StartTimerSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const property = await getPropertyById(parsed.data.property_id, user.id);
    if (!property) return { data: null, error: 'Property not found.' };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('active_timers')
      .insert({
        user_id:     user.id,
        property_id: parsed.data.property_id,
        title:       parsed.data.title,
        description: parsed.data.description,
        category:    parsed.data.category,
        is_billable: parsed.data.is_billable,
        source:      'timer',
      })
      .select()
      .single();

    if (error) {
      // Postgres unique violation: UNIQUE(user_id) on active_timers
      if (error.code === '23505') {
        return { data: null, error: 'A timer is already running. Stop it before starting a new one.' };
      }
      return { data: null, error: error.message };
    }

    revalidatePath('/dashboard');
    return { data, error: null };

  } catch (err) {
    if (err instanceof SubscriptionError) return { data: null, error: err.message };
    return { data: null, error: 'Unexpected error.' };
  }
}

// ── STOP TIMER ─────────────────────────────────────────────────────────────

export async function stopTimer(timerId: string): Promise<ActionResult<TimeLog>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    // Calls the stop_timer() Postgres function which:
    //   1. Locks the active_timers row with SELECT FOR UPDATE
    //   2. Inserts into time_logs (duration_secs computed in DB)
    //   3. Deletes from active_timers
    // All atomically — concurrent stop requests are safely serialized.
    const supabase = await createClient();
    const { data, error } = await supabase
      .rpc('stop_timer', {
        p_timer_id: timerId,
        p_user_id:  user.id,
      })
      .single();

    if (error) {
      if (error.message.includes('Timer not found')) {
        return { data: null, error: 'Timer not found or already stopped.' };
      }
      return { data: null, error: error.message };
    }

    revalidatePath('/dashboard');
    revalidatePath('/time');
    revalidatePath('/reports');
    return { data: data as TimeLog, error: null };

  } catch {
    return { data: null, error: 'Unexpected error.' };
  }
}

// ── UPDATE ─────────────────────────────────────────────────────────────────

export async function updateTimeLog(
  timeLogId: string,
  input: unknown
): Promise<ActionResult<TimeLog>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    const existing = await getTimeLogById(timeLogId, user.id);
    if (!existing) return { data: null, error: 'Time log not found.' };

    const parsed = UpdateTimeLogSchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('time_logs')
      .update(parsed.data)
      .eq('id', timeLogId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath('/time');
    return { data, error: null };

  } catch {
    return { data: null, error: 'Unexpected error.' };
  }
}

// ── DELETE (soft — P1.2 fix) ───────────────────────────────────────────────
// Previously would have been a hard DELETE.
// Sets deleted_at = NOW() so the row is invisible to all queries but
// retained for billing / tax audit trails.

export async function deleteTimeLog(timeLogId: string): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    const existing = await getTimeLogById(timeLogId, user.id);
    if (!existing) return { data: null, error: 'Time log not found.' };

    const supabase = await createClient();
    const { error } = await supabase
      .from('time_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', timeLogId)
      .eq('user_id', user.id);

    if (error) return { data: null, error: error.message };

    revalidatePath('/time');
    revalidatePath('/dashboard');
    revalidatePath('/reports');
    return { data: undefined, error: null };

  } catch {
    return { data: null, error: 'Unexpected error.' };
  }
}
