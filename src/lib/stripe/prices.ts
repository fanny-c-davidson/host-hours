export const STRIPE_PRICES = {
  starter_monthly:  process.env.STRIPE_PRICE_STARTER_MONTHLY!,
  starter_yearly:   process.env.STRIPE_PRICE_STARTER_YEARLY!,
  pro_monthly:      process.env.STRIPE_PRICE_PRO_MONTHLY!,
  pro_yearly:       process.env.STRIPE_PRICE_PRO_YEARLY!,
  business_monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY!,
  business_yearly:  process.env.STRIPE_PRICE_BUSINESS_YEARLY!,
} as const;

export type StripePriceId = typeof STRIPE_PRICES[keyof typeof STRIPE_PRICES];

export function getTierFromPriceId(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  if (priceId === STRIPE_PRICES.starter_monthly || priceId === STRIPE_PRICES.starter_yearly) return 'starter';
  if (priceId === STRIPE_PRICES.pro_monthly      || priceId === STRIPE_PRICES.pro_yearly)      return 'pro';
  if (priceId === STRIPE_PRICES.business_monthly || priceId === STRIPE_PRICES.business_yearly) return 'business';
  return null;
}
