import { createClient } from '@/lib/supabase/server';
import type { TimeLog } from '@/types/app';

export async function getTimeLogs(
  userId: string,
  options: {
    propertyId?: string;
    from?: string;
    to?: string;
    limit?: number;
  } = {}
): Promise<TimeLog[]> {
  const supabase = await createClient();
  let query = supabase
    .from('time_logs')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)          // P1.2: exclude soft-deleted rows
    .order('started_at', { ascending: false });

  if (options.propertyId) query = query.eq('property_id', options.propertyId);
  if (options.from)       query = query.gte('started_at', options.from);
  if (options.to)         query = query.lt('started_at', options.to);
  if (options.limit)      query = query.limit(options.limit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getTimeLogById(
  id: string,
  userId: string
): Promise<TimeLog | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}
