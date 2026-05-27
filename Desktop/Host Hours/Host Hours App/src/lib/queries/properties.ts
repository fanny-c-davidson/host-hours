import { createClient } from '@/lib/supabase/server';
import type { Property } from '@/types/app';

/**
 * All queries filter deleted_at IS NULL at both the query level and the
 * RLS SELECT policy — belt-and-suspenders to keep soft-deleted rows invisible.
 */

export async function getProperties(userId: string): Promise<Property[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function getPropertyById(
  id: string,
  userId: string
): Promise<Property | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  // PGRST116 = "no rows found" — expected when property doesn't exist or
  // isn't owned by this user. Any other error code is an infrastructure
  // problem and should propagate rather than silently becoming "not found".
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function countActiveProperties(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_archived', false)
    .is('deleted_at', null);

  if (error) throw error;
  return count ?? 0;
}
