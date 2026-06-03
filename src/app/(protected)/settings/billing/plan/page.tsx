"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    suffix: "forever",
    tagline: "Try before you buy.",
    features: ["1 property", "Manual logging only", "Basic reports (no export)"],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$19.99",
    suffix: "/mo",
    tagline: "For hosts with 2–5 doors.",
    features: [
      "Up to 5 properties",
      "Unlimited logging & timer",
      "PDF + CSV exports",
      "Team member tracking",
      "Priority email support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$49.99",
    suffix: "/mo",
    tagline: "For portfolios of 6+ doors.",
    features: [
      "Unlimited properties",
      "Portfolio analytics",
      "Multi-user access (5 seats)",
      "API access",
      "Dedicated account manager",
    ],
  },
];

export default function ChangePlanPage() {
  const router = useRouter();
  const [currentTier, setCurrentTier] = useState("free");
  const [selected, setSelected] = useState("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("tier_id")
        .eq("user_id", user.id)
        .single();

      const tier = sub?.tier_id || "free";
      setCurrentTier(tier);
      setSelected(tier);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isCurrent = selected === currentTier;

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings/billing" label="Change plan" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Plans
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Choose a plan.
        </h1>
      </header>

      <div className="px-7 py-6 flex flex-col gap-4">
        {plans.map((plan) => {
          const isSelected = selected === plan.id;
          const isPlanCurrent = currentTier === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelected(plan.id)}
              className={`text-left p-6 rounded-md border-[1.5px] transition-colors relative ${
                isSelected
                  ? "border-plum bg-cream"
                  : "border-chalk bg-cream hover:border-plum"
              }`}
            >
              {isPlanCurrent && (
                <span className="absolute -top-2.5 left-5 bg-plum text-cream font-mono text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 rounded-[999px] font-medium">
                  Current
                </span>
              )}
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
              <p className="font-serif italic text-[13px] text-quill mb-4">
                {plan.tagline}
              </p>
              <ul>
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="text-[13px] text-quill py-1.5 pl-[18px] relative leading-relaxed"
                  >
                    <span className="absolute left-1 top-2 text-tangerine font-bold text-base leading-none">
                      ·
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              {isSelected && !isPlanCurrent && (
                <div className="mt-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-plum" />
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum font-medium">
                    Selected
                  </span>
                </div>
              )}
            </button>
          );
        })}

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <button
            type="button"
            disabled={isCurrent}
            onClick={() => router.push("/settings/billing")}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isCurrent
              ? "This is your current plan"
              : plans.findIndex((p) => p.id === selected) < plans.findIndex((p) => p.id === currentTier)
                ? `Downgrade to ${plans.find((p) => p.id === selected)?.name}`
                : `Upgrade to ${plans.find((p) => p.id === selected)?.name}`}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full min-h-12 bg-cream text-quill border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-stone active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
