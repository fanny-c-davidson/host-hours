import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { PLAN_LIMITS, type PlanTier } from '@/lib/constants';

// ── Error type ─────────────────────────────────────────────────────────────

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NO_SUBSCRIPTION'
      | 'FEATURE_NOT_AVAILABLE'
      | 'PROPERTY_LIMIT_REACHED'
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

// ── Queries ────────────────────────────────────────────────────────────────

/** Returns the user's active tier, or null if no active subscription. */
export async function getActiveTier(userId: string): Promise<PlanTier | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('tier_id, status')
    .eq('user_id', userId)
    .in('status', ['active', 'trialing'])
    .maybeSingle();

  return (data?.tier_id as PlanTier) ?? null;
}

// ── Guards ─────────────────────────────────────────────────────────────────

/**
 * Asserts the user has an active subscription.
 * Returns { tier, limits } on success.
 * Throws SubscriptionError if no active subscription.
 */
export async function requireActivePlan(userId: string) {
  const tier = await getActiveTier(userId);
  if (!tier) {
    throw new SubscriptionError(
      'No active subscription. Please subscribe to continue.',
      'NO_SUBSCRIPTION'
    );
  }
  return { tier, limits: PLAN_LIMITS[tier] };
}

/**
 * Asserts a specific feature is included on the user's plan.
 * Throws SubscriptionError if the plan does not include the feature.
 */
export async function requireFeature(
  userId: string,
  feature: keyof typeof PLAN_LIMITS[PlanTier]
) {
  const { tier, limits } = await requireActivePlan(userId);

  if (!limits[feature]) {
    const labels: Record<string, string> = {
      hasLiveTimer:    'Live Timer',
      hasCsvExport:    'CSV Export',
      hasGeoAutoStart: 'Geo Auto-Start',
      hasTeamMembers:  'Team Members',
    };
    throw new SubscriptionError(
      `${labels[feature as string] ?? feature} is not available on the ${tier} plan. Please upgrade.`,
      'FEATURE_NOT_AVAILABLE'
    );
  }

  return { tier, limits };
}

/**
 * Asserts the user has not reached their plan's property limit.
 * Throws SubscriptionError if at or over the limit.
 */
export async function requirePropertySlot(userId: string) {
  const { tier, limits } = await requireActivePlan(userId);

  if (limits.maxProperties === Infinity) {
    return { tier, limits };
  }

  const supabase = await createClient();
  const { count, error } = await supabase
    .from('properties')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_archived', false)
    .is('deleted_at', null);

  if (error) throw new Error(error.message);

  if ((count ?? 0) >= limits.maxProperties) {
    throw new SubscriptionError(
      `Your ${tier} plan allows up to ${limits.maxProperties} ${limits.maxProperties === 1 ? 'property' : 'properties'}. Upgrade to add more.`,
      'PROPERTY_LIMIT_REACHED'
    );
  }

  return { tier, limits };
}
