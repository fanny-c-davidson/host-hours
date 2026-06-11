import type { Database } from './database';
import type { PlanTier, PlanLimits } from '@/lib/constants';

// ── Table row types ────────────────────────────────────────────────────────

export type Profile     = Database['public']['Tables']['profiles']['Row'];
export type Property    = Database['public']['Tables']['properties']['Row'];
export type TimeLog     = Database['public']['Tables']['time_logs']['Row'];
export type ActiveTimer = Database['public']['Tables']['active_timers']['Row'];
export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type TeamMember  = Database['public']['Tables']['team_members']['Row'];
export type PropertyAssignment = Database['public']['Tables']['property_assignments']['Row'];
export type Invitation  = Database['public']['Tables']['invitations']['Row'];
export type RolePermission = Database['public']['Tables']['role_permissions']['Row'];

// ── Composed types ─────────────────────────────────────────────────────────

export type SubscriptionWithPlan = Subscription & {
  tier: PlanTier | null;
  limits: PlanLimits | null;
};

// ── Server Action return type ──────────────────────────────────────────────
//
// All Server Actions return this discriminated union.
// Callers check `result.error` before accessing `result.data`.

export type ActionResult<T = void> =
  | { data: T;    error: null }
  | { data: null; error: string };

// Re-export plan types for convenience
export type { PlanTier, PlanLimits };
