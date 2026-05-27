import 'server-only';
import { createClient } from '@/lib/supabase/server';
import type { ActionResult } from '@/types/app';

/**
 * Returns the authenticated user or null.
 *
 * Uses getUser() (not getSession()) to re-validate the JWT against
 * Supabase Auth on every call — prevents forged session attacks.
 *
 * Usage pattern in Server Actions:
 *
 *   const user = await getAuthenticatedUser();
 *   if (!user) return { data: null, error: 'Unauthorized' };
 *
 * Returning early like this — rather than throwing — ensures the
 * 'Unauthorized' message reaches the client instead of being swallowed
 * by the catch block as 'Unexpected error'.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user ?? null;
}

/** Convenience type for early-return auth check results. */
export type AuthGuard = { data: null; error: 'Unauthorized' };
export const UNAUTHORIZED: ActionResult<never> = { data: null, error: 'Unauthorized' };
