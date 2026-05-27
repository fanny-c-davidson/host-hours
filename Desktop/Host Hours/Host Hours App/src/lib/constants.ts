export const PLAN_LIMITS = {
  starter: {
    maxProperties: 3,
    hasLiveTimer: false,
    hasCsvExport: false,
    hasGeoAutoStart: false,
    hasTeamMembers: false,
  },
  pro: {
    maxProperties: Infinity,
    hasLiveTimer: true,
    hasCsvExport: true,
    hasGeoAutoStart: false,
    hasTeamMembers: false,
  },
  business: {
    maxProperties: Infinity,
    hasLiveTimer: true,
    hasCsvExport: true,
    hasGeoAutoStart: true,
    hasTeamMembers: true,
  },
} as const;

export type PlanTier = keyof typeof PLAN_LIMITS;
export type PlanLimits = typeof PLAN_LIMITS[PlanTier];
