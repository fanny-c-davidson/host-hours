"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dock } from "@/components/dock";
import { createClient } from "@/lib/supabase/client";
import { getMyAutoTimer, updateMyAutoTimer } from "@/lib/actions/team";

function Toggle({ defaultOn = false }: { defaultOn?: boolean }) {
  return (
    <button
      type="button"
      className={`relative w-10 h-6 rounded-[999px] shrink-0 transition-colors ${
        defaultOn ? "bg-plum" : "bg-chalk"
      }`}
      onClick={(e) => {
        const el = e.currentTarget;
        el.classList.toggle("bg-plum");
        el.classList.toggle("bg-chalk");
        const knob = el.querySelector("span")!;
        knob.classList.toggle("translate-x-4");
      }}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] bg-cream rounded-full transition-transform ${
          defaultOn ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

function SectionBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-7 pt-6 pb-3 font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium border-t border-chalk">
      {children}
    </div>
  );
}

function SettingRow({
  label,
  sub,
  value,
  arrow,
  toggle,
  toggleOn,
}: {
  label: string;
  sub?: string;
  value?: string;
  arrow?: boolean;
  toggle?: boolean;
  toggleOn?: boolean;
}) {
  return (
    <div className="px-7 py-4 border-b border-chalk grid grid-cols-[1fr_auto] gap-4 items-center cursor-pointer transition-colors hover:bg-vellum">
      <div className="min-w-0">
        <div className="font-serif text-[15px] font-medium text-char tracking-[-0.2px] mb-0.5">
          {label}
        </div>
        {sub && <div className="text-xs text-slate">{sub}</div>}
      </div>
      {value && (
        <div className="font-mono text-[13px] text-plum font-medium tabular-nums">
          {value}
        </div>
      )}
      {arrow && <span className="text-stone font-mono text-sm">→</span>}
      {toggle && <Toggle defaultOn={toggleOn} />}
    </div>
  );
}

const PLAN_INFO: Record<string, { name: string; price: string; tagline: string; features: string[] }> = {
  free: {
    name: "Free",
    price: "$0",
    tagline: "Try before you buy.",
    features: ["1 property", "Manual logging only", "Basic reports (no export)"],
  },
  professional: {
    name: "Professional",
    price: "$19.99",
    tagline: "For hosts with 2–5 doors.",
    features: ["Up to 5 properties", "Unlimited logging & timer", "PDF + CSV exports", "Team member tracking", "Priority email support"],
  },
  enterprise: {
    name: "Enterprise",
    price: "$49.99",
    tagline: "For portfolios of 6+ doors.",
    features: ["Unlimited properties", "Portfolio analytics", "Multi-user access (5 seats)", "API access", "Dedicated account manager"],
  },
};

export default function SettingsPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [initials, setInitials] = useState("");
  const [tierId, setTierId] = useState("free");
  const [propertyCount, setPropertyCount] = useState(0);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [taxYear, setTaxYear] = useState(2026);
  const [targetTest, setTargetTest] = useState("500");
  const [goalHours, setGoalHours] = useState(500);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [autoTimer, setAutoTimer] = useState(false);
  const [defaultTask, setDefaultTask] = useState("");
  const [autoTimerStatus, setAutoTimerStatus] = useState<"saving" | "saved" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email, tax_year, target_test, goal_hours")
        .eq("id", user.id)
        .single();

      const name = profile?.full_name || user.user_metadata?.full_name || "";
      setFullName(name);
      setEmail(profile?.email || user.email || "");
      if (profile?.tax_year) setTaxYear(profile.tax_year);
      if (profile?.target_test) setTargetTest(profile.target_test);
      if (profile?.goal_hours) setGoalHours(profile.goal_hours);
      const parts = name.split(" ").filter(Boolean);
      setInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : name.substring(0, 2).toUpperCase()
      );

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("tier_id, current_period_end")
        .eq("user_id", user.id)
        .single();

      setTierId(sub?.tier_id || "free");
      setPeriodEnd(sub?.current_period_end || null);

      const { count } = await supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);

      setPropertyCount(count ?? 0);

      const { data: membership } = await supabase
        .from("team_members")
        .select("owner_id, role")
        .eq("member_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (membership) {
        setIsTeamMember(true);
        setTeamRole(membership.role);
        // Helpers/managers default to a 100-hour goal (no IRS target test).
        if (
          (membership.role === "employee" || membership.role === "manager") &&
          (profile?.goal_hours ?? 500) === 500
        ) {
          setGoalHours(100);
        }
      }

      // Auto-timer applies to everyone — owners store it on their profile,
      // team members on their membership row.
      const at = await getMyAutoTimer();
      if (at.data) {
        setAutoTimer(at.data.autoTimerEnabled);
        setDefaultTask(at.data.defaultTask);
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  const plan = PLAN_INFO[tierId] || PLAN_INFO.free;
  const maxProps = tierId === "enterprise" ? null : tierId === "professional" ? 5 : 1;
  // Helpers and managers don't have an IRS target test — only a goal.
  const isStaff = isTeamMember && (teamRole === "employee" || teamRole === "manager");

  async function saveAutoTimer(enabled: boolean, task: string) {
    setAutoTimer(enabled);
    setDefaultTask(task);
    setAutoTimerStatus("saving");
    const res = await updateMyAutoTimer(enabled, task);
    if (res.error) {
      setAutoTimerStatus(null);
      return;
    }
    setAutoTimerStatus("saved");
    setTimeout(() => setAutoTimerStatus((s) => (s === "saved" ? null : s)), 2000);
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-cream items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        <Dock />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-cream">
      <div className="flex items-center justify-between px-7 pt-5 pb-1 shrink-0">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[1px] uppercase text-quill hover:text-plum py-2 px-0.5"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="7.5 9 4.5 6 7.5 3" />
          </svg>
          Back
        </Link>
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-slate">
          Settings
        </span>
      </div>

      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-7 pt-2 pb-6 border-b border-chalk">
          <h1 className="font-serif text-[28px] font-medium text-plum tracking-[-0.6px]">
            Settings
          </h1>
        </div>

        {/* Profile */}
        <div className="px-7 py-6 border-b border-chalk grid grid-cols-[56px_1fr_auto] gap-4 items-center">
          <div className="w-14 h-14 rounded-full bg-plum text-cream flex items-center justify-center font-serif font-medium text-[22px] tracking-[-0.4px]">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="font-serif text-[19px] font-medium text-char tracking-[-0.3px] mb-0.5">
              {fullName}
            </div>
            <div className="text-xs text-slate">{email}</div>
          </div>
          <span className="font-mono text-[9px] tracking-[1.5px] uppercase text-tangerine border border-tangerine px-2 py-1 rounded-[999px] font-medium">
            {plan.name}
          </span>
        </div>

        {/* Plan & billing (owner only) */}
        {!isTeamMember && (
          <>
            <SectionBar>Plan &amp; billing</SectionBar>

            {/* Current plan */}
            <div className="mx-7 mt-4 p-6 border-[1.5px] border-plum rounded-md relative bg-cream">
              <span className="absolute -top-2.5 left-5 bg-plum text-cream font-mono text-[9px] tracking-[1.5px] uppercase px-2.5 py-1 rounded-[999px] font-medium">
                Current
              </span>
              <div className="flex justify-between items-baseline mb-1">
                <div className="font-serif text-2xl font-medium text-plum tracking-[-0.5px]">
                  {plan.name}
                </div>
                <div className="font-serif text-[22px] font-medium text-char tracking-[-0.5px] tabular-nums">
                  {plan.price}
                  <span className="font-sans text-xs text-slate font-normal">
                    {tierId === "free" ? " forever" : "/mo"}
                  </span>
                </div>
              </div>
              <div className="font-serif italic text-[13px] text-quill mb-4">
                {plan.tagline}
              </div>
              <ul className="mb-4">
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
              {maxProps && (
                <div className="font-mono text-[11px] tracking-[0.5px] text-success mb-1.5">
                  <strong className="font-medium tabular-nums">{propertyCount} of {maxProps}</strong> properties in use
                </div>
              )}
              {periodEnd && (
                <div className="font-mono text-[10px] tracking-[1px] text-slate uppercase">
                  Renews {new Date(periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </div>
              )}
            </div>

            {/* Show upgrade options for non-enterprise users */}
            {tierId !== "enterprise" && (
              <div className="mx-7 mt-4 mb-6">
                <Link
                  href="/settings/billing/plan"
                  className="block w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center"
                >
                  Change plan →
                </Link>
              </div>
            )}
          </>
        )}

        {/* Account */}
        <SectionBar>Account</SectionBar>
        <Link href="/settings/profile">
          <SettingRow label="Edit profile" sub={`${fullName} · ${email}`} arrow />
        </Link>
        <Link href="/settings/password">
          <SettingRow label="Change password" arrow />
        </Link>
        {!isTeamMember && (
          <Link href="/settings/billing">
            <SettingRow label="Subscription & billing" sub={`${plan.name} plan`} arrow />
          </Link>
        )}

        {/* Team — helpers can't manage team members, so hide the section for them. */}
        {!(isTeamMember && teamRole === "employee") && (
          <>
            <SectionBar>Team</SectionBar>
            <Link href="/settings/team">
              <SettingRow label="Manage team" arrow />
            </Link>
          </>
        )}

        {/* Auto-timer — available to everyone (owners + team members) */}
        {(
          <>
            <SectionBar>Auto-timer</SectionBar>
            <div className="mx-7 mt-4 mb-6 p-5 border-[1.5px] border-chalk rounded-md bg-cream">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-serif text-[16px] font-medium text-char">
                    Auto start/stop
                  </div>
                  <p className="text-[12px] text-slate leading-relaxed mt-0.5">
                    Start the timer when you arrive at an assigned property and stop it when you leave.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={autoTimer}
                  onClick={() => saveAutoTimer(!autoTimer, defaultTask)}
                  className={`shrink-0 w-10 h-6 rounded-full relative transition-colors ${
                    autoTimer ? "bg-plum" : "bg-stone/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
                      autoTimer ? "left-[18px]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              {autoTimer && (
                <div className="mt-4">
                  <label className="font-mono text-[9px] tracking-[1.5px] uppercase text-slate mb-1.5 block">
                    Default task
                  </label>
                  <input
                    type="text"
                    value={defaultTask}
                    onChange={(e) => setDefaultTask(e.target.value)}
                    onBlur={() => saveAutoTimer(autoTimer, defaultTask)}
                    placeholder="e.g. Cleaning"
                    className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                  />
                  <p className="mt-1.5 text-[11px] text-slate">
                    The task the auto-started timer logs.
                  </p>
                </div>
              )}

              <div className="h-4 mt-2">
                {autoTimerStatus === "saving" && (
                  <span className="text-[11px] text-slate">Saving…</span>
                )}
                {autoTimerStatus === "saved" && (
                  <span className="text-[11px] text-success">Saved</span>
                )}
              </div>
            </div>
          </>
        )}

        {/* Target & Goal */}
        <SectionBar>Target &amp; Goal</SectionBar>

        <div className="mx-7 mt-4 mb-6 p-6 border-[1.5px] border-chalk rounded-md bg-cream">
          <div className={`grid ${isStaff ? "grid-cols-2" : "grid-cols-3"} gap-4 mb-5`}>
            <div>
              <div className="font-mono text-[9px] tracking-[1.5px] uppercase text-slate mb-1">
                Tax year
              </div>
              <div className="font-serif text-[20px] font-medium text-char tracking-[-0.3px]">
                {taxYear}
              </div>
            </div>
            <div>
              <div className="font-mono text-[9px] tracking-[1.5px] uppercase text-slate mb-1">
                Goal
              </div>
              <div className="font-serif text-[20px] font-medium text-char tracking-[-0.3px]">
                {goalHours}
                <span className="font-sans text-[12px] text-slate font-normal"> hrs</span>
              </div>
            </div>
            {!isStaff && (
              <div>
                <div className="font-mono text-[9px] tracking-[1.5px] uppercase text-slate mb-1">
                  Target
                </div>
                <div className="font-serif text-[15px] font-medium text-char tracking-[-0.2px] leading-snug">
                  {targetTest === "substantially" ? "Subst. all" : `${targetTest} hrs`}
                </div>
              </div>
            )}
          </div>

          <Link
            href="/settings/tax"
            className="block w-full min-h-12 py-3 rounded-md text-center font-mono text-[11px] tracking-[1.5px] uppercase text-plum border border-plum hover:bg-plum hover:text-cream active:scale-[0.98] transition-all"
          >
            Edit settings
          </Link>
        </div>

        {/* Support */}
        <SectionBar>Support</SectionBar>
        <Link href="/settings/contact">
          <SettingRow label="Contact us" arrow />
        </Link>
        <a href="https://www.irs.gov/publications/p925" target="_blank" rel="noopener noreferrer">
          <SettingRow
            label="IRS guidelines"
            sub="Publication 925 explained"
            arrow
          />
        </a>
        <SettingRow label="About Host Hours" value="v1.0.0" />

        {/* Sign out */}
        <div className="px-7 mt-6 mb-24">
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full min-h-12 py-3.5 rounded-md text-center font-mono text-[11px] tracking-[1.5px] uppercase text-quill border border-chalk hover:border-stone hover:text-plum active:scale-[0.98] transition-all"
          >
            Sign out
          </button>
        </div>
      </div>

      <Dock />
    </div>
  );
}
