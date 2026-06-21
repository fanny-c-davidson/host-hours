"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

const PLAN_INFO: Record<string, { name: string; price: string; suffix: string; description: string }> = {
  free: {
    name: "Free",
    price: "$0",
    suffix: "forever",
    description: "1 property · Manual logging only · Basic reports",
  },
  professional: {
    name: "Professional",
    price: "$19.99",
    suffix: "/mo",
    description: "Up to 5 properties · Unlimited logging · PDF + CSV exports",
  },
  enterprise: {
    name: "Enterprise",
    price: "$49.99",
    suffix: "/mo",
    description: "Unlimited properties · Portfolio analytics · Multi-user access",
  },
};

export default function BillingPage() {
  const [tierId, setTierId] = useState("free");
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("tier_id, current_period_end")
        .eq("user_id", user.id)
        .single();

      setTierId(sub?.tier_id || "free");
      setPeriodEnd(sub?.current_period_end || null);
      setLoading(false);
    }
    load();
  }, []);

  const plan = PLAN_INFO[tierId] || PLAN_INFO.free;
  const isFree = tierId === "free";

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings" label="Billing" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Billing
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Subscription.
        </h1>
      </header>

      <div className="px-7 py-6 flex flex-col gap-6">
        {/* Current plan */}
        <div className="p-6 border-[1.5px] border-plum rounded-md relative bg-cream">
          <span className="absolute -top-2.5 left-5 bg-plum text-cream font-mono text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 rounded-[999px] font-medium">
            Current plan
          </span>
          <div className="flex justify-between items-baseline mb-1">
            <span className="font-serif text-2xl font-medium text-plum tracking-[-0.5px]">
              {plan.name}
            </span>
            <span className="font-serif text-[22px] font-medium text-char tracking-[-0.5px] tabular-nums">
              {plan.price}
              <span className="font-sans text-xs text-slate font-normal">
                {" "}{plan.suffix}
              </span>
            </span>
          </div>
          <p className="font-sans text-[13px] text-slate mt-2">
            {plan.description}
          </p>
          <div className="mt-4 flex items-center justify-between">
            {periodEnd && (
              <span className="font-mono text-[10px] tracking-[1px] uppercase text-slate">
                Renews {new Date(periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
            {!periodEnd && isFree && (
              <span className="font-mono text-[10px] tracking-[1px] uppercase text-slate">
                No expiration
              </span>
            )}
            <Link
              href="/settings/billing/plan"
              className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px] font-medium"
            >
              Change plan
            </Link>
          </div>
        </div>

        {/* Payment method - only show for paid plans */}
        {!isFree && (
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3 block">
              Payment method
            </label>
            <div className="p-5 border border-chalk rounded-md bg-cream flex items-center justify-between">
              <span className="font-sans text-[13px] text-slate">
                No payment method on file
              </span>
              <Link
                href="/settings/billing/payment"
                className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px] font-medium"
              >
                Add
              </Link>
            </div>
          </div>
        )}

        {/* Cancel subscription - only for paid plans */}
        {!isFree && (
          <div className="pt-4 border-t border-chalk">
            <button
              type="button"
              className="w-full min-h-12 bg-cream text-tangerine border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-tangerine active:scale-[0.98] transition-all"
            >
              Cancel subscription
            </button>
            <p className="font-sans text-[12px] text-slate text-center mt-3">
              You&rsquo;ll keep access until your current billing period ends.
            </p>
          </div>
        )}

        {/* Upgrade CTA for free users */}
        {isFree && (
          <div className="pt-4 border-t border-chalk">
            <Link
              href="/settings/billing/plan"
              className="block w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center"
            >
              Upgrade your plan
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
