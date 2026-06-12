"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dock } from "@/components/dock";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS, type TeamRole } from "@/lib/permissions";

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
  const [teamCount, setTeamCount] = useState(0);
  const [cohostName, setCohostName] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamOwnerName, setTeamOwnerName] = useState<string | null>(null);
  const [teamOwnerEmail, setTeamOwnerEmail] = useState<string | null>(null);
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; role: string; status: string; email: string; fullName: string | null }>>([]);
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

      const { data: teamData } = await supabase
        .from("team_members")
        .select("id, role, status, email, member_id")
        .eq("owner_id", user.id);

      const userEmail = (user.email || "").toLowerCase();
      const activeTeam = (teamData ?? []).filter((t) =>
        (t.status === "active" || t.status === "pending") &&
        t.member_id !== user.id &&
        t.email.toLowerCase() !== userEmail
      );
      setTeamCount(activeTeam.length);

      const memberIds = activeTeam.filter((t) => t.member_id).map((t) => t.member_id!);
      let profileMap: Record<string, string> = {};
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", memberIds);
        profileMap = (profiles ?? []).reduce((acc, p) => ({ ...acc, [p.id]: p.full_name }), {} as Record<string, string>);
      }

      setTeamMembers(activeTeam.map((t) => ({
        id: t.id,
        role: t.role,
        status: t.status,
        email: t.email,
        fullName: t.member_id ? profileMap[t.member_id] ?? null : null,
      })));

      const cohost = activeTeam.find((t) => t.role === "spouse" && t.status === "active");
      if (cohost?.member_id) {
        setCohostName(profileMap[cohost.member_id] ?? null);
      }

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
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", membership.owner_id)
          .single();
        setTeamOwnerName(ownerProfile?.full_name ?? null);
        setTeamOwnerEmail(ownerProfile?.email ?? null);
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

        {/* Team */}
        <SectionBar>Team</SectionBar>
        {isTeamMember && teamMembers.length === 0 ? (
          <Link href="/settings/team">
            <SettingRow
              label={teamRole ? ROLE_LABELS[teamRole as TeamRole] : "Team member"}
              sub={teamOwnerName ? `${teamOwnerName}${teamOwnerEmail ? ` (${teamOwnerEmail})` : ""}` : "Team owner"}
              arrow
            />
          </Link>
        ) : (
          <>
            <Link href="/settings/team">
              <SettingRow
                label="Owner"
                sub={`${fullName} (${email})`}
                arrow
              />
            </Link>
            {teamMembers.map((member) => (
              <Link key={member.id} href="/settings/team">
                <SettingRow
                  label={`${ROLE_LABELS[member.role as TeamRole] || member.role}${member.status === "pending" ? " (pending)" : ""}`}
                  sub={member.fullName ? `${member.fullName} (${member.email})` : member.email}
                  arrow
                />
              </Link>
            ))}
            <Link href="/settings/team">
              <SettingRow label="Invite team member" sub="Add spouse or helpers" arrow />
            </Link>
          </>
        )}

        {/* Target & Goal */}
        <SectionBar>Target &amp; Goal</SectionBar>

        <div className="mx-7 mt-4 mb-6 p-6 border-[1.5px] border-chalk rounded-md bg-cream">
          <div className="grid grid-cols-3 gap-4 mb-5">
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
            <div>
              <div className="font-mono text-[9px] tracking-[1.5px] uppercase text-slate mb-1">
                Target
              </div>
              <div className="font-serif text-[15px] font-medium text-char tracking-[-0.2px] leading-snug">
                {targetTest === "substantially" ? "Subst. all" : `${targetTest} hrs`}
              </div>
            </div>
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
