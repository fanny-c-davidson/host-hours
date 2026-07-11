import 'server-only';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import type { ActionResult } from '@/types/app';

/**
 * Returns the authenticated user or null.
 *
 * Uses getUser() (not getSession()) to re-validate the JWT against
 * Supabase Auth on every call — prevents forged session attacks.
 *
 * Falls back to an `Authorization: Bearer <access token>` header (also
 * validated against Supabase Auth) so the mobile app can call these actions
 * through the /api/team bridge with its token-based session.
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
  if (user) return user;

  const authz = (await headers()).get('authorization');
  const token = authz?.startsWith('Bearer ') ? authz.slice(7) : null;
  if (!token) return null;

  const { data } = await createServiceClient().auth.getUser(token);
  return data.user ?? null;
}

/** Convenience type for early-return auth check results. */
export type AuthGuard = { data: null; error: 'Unauthorized' };
export const UNAUTHORIZED: ActionResult<never> = { data: null, error: 'Unauthorized' };
