'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedUser, UNAUTHORIZED } from '@/lib/actions/_helpers';
import { requirePropertySlot, SubscriptionError } from '@/lib/subscriptions';
import { getPropertyById } from '@/lib/queries/properties';
import {
  CreatePropertySchema,
  UpdatePropertySchema,
} from '@/lib/validations/property';
import type { ActionResult, Property } from '@/types/app';

// ── CREATE ─────────────────────────────────────────────────────────────────

export async function createProperty(
  input: unknown
): Promise<ActionResult<Property>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {
    // Server-side plan check: verifies active subscription + property count
    await requirePropertySlot(user.id);

    const parsed = CreatePropertySchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('properties')
      .insert({ ...parsed.data, user_id: user.id })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath('/properties');
    revalidatePath('/dashboard');
    return { data, error: null };

  } catch (err) {
    if (err instanceof SubscriptionError) return { data: null, error: err.message };
    return { data: null, error: 'Unexpected error. Please try again.' };
  }
}

// ── UPDATE ─────────────────────────────────────────────────────────────────

export async function updateProperty(
  propertyId: string,
  input: unknown
): Promise<ActionResult<Property>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    const parsed = UpdatePropertySchema.safeParse(input);
    if (!parsed.success) {
      return { data: null, error: parsed.error.issues[0].message };
    }

    // Ownership check (belt + suspenders alongside RLS)
    const existing = await getPropertyById(propertyId, user.id);
    if (!existing) return { data: null, error: 'Property not found.' };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('properties')
      .update(parsed.data)
      .eq('id', propertyId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    revalidatePath('/properties');
    revalidatePath(`/properties/${propertyId}`);
    return { data, error: null };

  } catch {
    return { data: null, error: 'Unexpected error. Please try again.' };
  }
}

// ── ARCHIVE (hide from list, keep data) ───────────────────────────────────

export async function archiveProperty(propertyId: string): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    const existing = await getPropertyById(propertyId, user.id);
    if (!existing) return { data: null, error: 'Property not found.' };

    const supabase = await createClient();
    const { error } = await supabase
      .from('properties')
      .update({ is_archived: true, archived_at: new Date().toISOString() })
      .eq('id', propertyId)
      .eq('user_id', user.id);

    if (error) return { data: null, error: error.message };

    revalidatePath('/properties');
    revalidatePath('/dashboard');
    return { data: undefined, error: null };

  } catch {
    return { data: null, error: 'Unexpected error. Please try again.' };
  }
}

// ── DELETE (soft — P1.2 fix) ───────────────────────────────────────────────
// Previously: hard DELETE — permanently destroyed all associated time_logs.
// Now: sets deleted_at = NOW(). The property and its time logs become
// invisible to all queries (RLS + .is('deleted_at', null) filters) but
// are retained in the DB for billing/audit purposes.

export async function deleteProperty(propertyId: string): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  try {

    const existing = await getPropertyById(propertyId, user.id);
    if (!existing) return { data: null, error: 'Property not found.' };

    const supabase = await createClient();
    const { error } = await supabase
      .from('properties')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', propertyId)
      .eq('user_id', user.id);

    if (error) return { data: null, error: error.message };

    revalidatePath('/properties');
    revalidatePath('/dashboard');
    return { data: undefined, error: null };

  } catch {
    return { data: null, error: 'Unexpected error. Please try again.' };
  }
}
