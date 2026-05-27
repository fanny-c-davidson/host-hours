"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dock } from "@/components/dock";
import { createClient } from "@/lib/supabase/client";

type Property = {
  id: string;
  name: string;
  address: string | null;
  color: string;
};

type TimeLog = {
  id: string;
  title: string;
  category: string;
  started_at: string;
  duration_secs: number;
  property: { name: string } | null;
};

export default function DashboardPage() {
  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [recentActivity, setRecentActivity] = useState<TimeLog[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [entriesLogged, setEntriesLogged] = useState(0);
  const [loading, setLoading] = useState(true);

  const goalHours = 500;
  const goalPct = goalHours > 0 ? Math.min((totalHours / goalHours) * 100, 100) : 0;

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const fullName = profile?.full_name || user.user_metadata?.full_name || "there";
      setUserName(fullName.split(" ")[0]);
      const parts = fullName.split(" ").filter(Boolean);
      setUserInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : fullName.substring(0, 2).toUpperCase()
      );

      const { data: props } = await supabase
        .from("properties")
        .select("id, name, address, color")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3);

      setProperties(props ?? []);

      const { data: logs, count } = await supabase
        .from("time_logs")
        .select("id, title, category, started_at, duration_secs, property:properties(name)", { count: "exact" })
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(5);

      setRecentActivity((logs as TimeLog[] | null) ?? []);
      setEntriesLogged(count ?? 0);

      const { data: sumData } = await supabase
        .from("time_logs")
        .select("duration_secs")
        .is("deleted_at", null);

      const totalSecs = (sumData ?? []).reduce((sum, r) => sum + (r.duration_secs ?? 0), 0);
      setTotalHours(totalSecs / 3600);

      setLoading(false);
    }
    load();
  }, []);

  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  function formatDayLabel(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - entryDate.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function formatCategory(cat: string) {
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const hasProperties = properties.length > 0;
  const hasActivity = recentActivity.length > 0;
  const isNewUser = !hasProperties && !hasActivity;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream pb-24 flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        <Dock />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-24">
      {/* ── Masthead ────────────────────────────────────────────── */}
      <header className="px-7 py-3 border-b border-chalk flex justify-between items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[1px] text-slate">
            {dayName} &middot; {monthDay}
          </p>
          <h1 className="font-serif text-[18px] font-medium text-char leading-snug">
            {greeting}, {userName}
          </h1>
        </div>

        <Link href="/settings" aria-label="Settings">
          <span className="flex items-center justify-center w-[44px] h-[44px] rounded-full bg-plum text-cream font-serif text-[15px]">
            {userInitials}
          </span>
        </Link>
      </header>

      {/* ── Welcome / Onboarding (new user) ─────────────────────── */}
      {isNewUser && (
        <section className="px-7 py-12 border-b border-chalk">
          <span className="font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium">
            Welcome to Host Hours
          </span>
          <h2 className="font-serif text-[36px] font-normal text-plum tracking-[-1.2px] leading-none mt-2 mb-4">
            Let&rsquo;s get started.
          </h2>
          <p className="font-sans text-[14px] text-quill leading-relaxed mb-8">
            Add your first property to start tracking hours toward IRS material
            participation. Every hour you log brings you closer to qualifying for
            tax deductions.
          </p>

          <div className="flex flex-col gap-3">
            <Link
              href="/properties/new"
              className="w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center"
            >
              Add your first property
            </Link>
            <Link
              href="/settings/tax"
              className="w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-cream text-quill border border-chalk hover:border-stone transition-colors text-center"
            >
              Set your tax goal
            </Link>
          </div>

          <div className="mt-10 flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-7 h-7 rounded-full bg-plum text-cream font-mono text-[12px] font-medium flex items-center justify-center">
                1
              </span>
              <div>
                <span className="font-serif text-[15px] font-medium text-char block">
                  Add a property
                </span>
                <span className="font-sans text-[12px] text-slate">
                  Name, address, and a color to keep things organized.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-7 h-7 rounded-full bg-chalk text-quill font-mono text-[12px] font-medium flex items-center justify-center">
                2
              </span>
              <div>
                <span className="font-serif text-[15px] font-medium text-char block">
                  Track your time
                </span>
                <span className="font-sans text-[12px] text-slate">
                  Use the timer or log hours manually after the fact.
                </span>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <span className="shrink-0 w-7 h-7 rounded-full bg-chalk text-quill font-mono text-[12px] font-medium flex items-center justify-center">
                3
              </span>
              <div>
                <span className="font-serif text-[15px] font-medium text-char block">
                  Hit your goal
                </span>
                <span className="font-sans text-[12px] text-slate">
                  Export an audit-ready report for your accountant.
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── YTD Section (has data) ──────────────────────────────── */}
      {!isNewUser && (
        <section className="px-7 py-9 border-b border-chalk">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[1px] text-slate">
              2026 &middot; Year to date
            </span>
            {totalHours < goalHours && (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-tangerine" />
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-tangerine">
                  {Math.ceil(goalHours - totalHours)} hours from goal
                </span>
              </>
            )}
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif text-[96px] font-normal text-plum tracking-[-5px] tabular-nums leading-none">
              {totalHours.toFixed(1)}
            </span>
            <span className="font-serif text-[28px] italic text-quill">hours</span>
          </div>

          <p className="mt-2 font-sans text-[12px] text-slate">
            Across {properties.length} properties &middot; {entriesLogged} entries logged
          </p>

          <div className="relative mt-5 h-[4px] rounded-full bg-bone overflow-visible">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-plum"
              style={{ width: `${goalPct}%` }}
            />
            {goalPct > 0 && (
              <span
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-tangerine"
                style={{ left: `${goalPct}%` }}
              />
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="font-sans text-[12px] text-slate">
              {goalPct.toFixed(1)}% to {goalHours}-hour goal
            </span>
            {entriesLogged > 0 && (
              <Link
                href="/reports"
                className="font-mono text-[10px] uppercase tracking-[1px] text-tangerine"
              >
                View reports &rarr;
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── Properties Section ──────────────────────────────────── */}
      {!isNewUser && (
        <section>
          <div className="px-7 py-4 flex items-center justify-between border-b border-chalk">
            <h2 className="font-serif text-[22px]">Your properties</h2>
            <Link
              href="/properties"
              className="font-mono text-[10px] uppercase tracking-[1px] text-plum"
            >
              All &rarr;
            </Link>
          </div>

          {hasProperties ? (
            <>
              {properties.map((prop) => (
                <div
                  key={prop.id}
                  className="px-7 py-[22px] border-b border-chalk flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: prop.color }}
                    />
                    <div className="flex flex-col gap-1">
                      <span className="font-serif text-[19px] font-medium leading-snug">
                        {prop.name}
                      </span>
                      {prop.address && (
                        <span className="font-sans text-[12px] text-slate">
                          {prop.address}
                        </span>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        <Link
                          href="/timer"
                          className="font-mono text-[10px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3"
                        >
                          Start timer
                        </Link>
                        <Link
                          href="/log"
                          className="font-mono text-[10px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3"
                        >
                          Log hours
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="border-b border-chalk px-7 py-5 flex justify-center">
                <Link
                  href="/properties/new"
                  className="font-mono text-[11px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3"
                >
                  + Add another property
                </Link>
              </div>
            </>
          ) : (
            <div className="px-7 py-10 border-b border-chalk text-center">
              <p className="font-serif text-[17px] text-quill mb-4">
                No properties yet.
              </p>
              <Link
                href="/properties/new"
                className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors"
              >
                Add your first property
              </Link>
            </div>
          )}
        </section>
      )}

      {/* ── Recent Activity Section ─────────────────────────────── */}
      {!isNewUser && (
        <section>
          <div className="px-7 py-4 flex items-center justify-between border-b border-chalk">
            <h2 className="font-serif text-[22px]">Recent activity</h2>
            {entriesLogged > 5 && (
              <Link
                href="/reports?tab=activity"
                className="font-mono text-[10px] uppercase tracking-[1px] text-plum"
              >
                All &rarr;
              </Link>
            )}
          </div>

          {hasActivity ? (
            recentActivity.map((entry) => (
              <Link
                key={entry.id}
                href={`/activity/${entry.id}/edit`}
                className="px-7 py-[18px] border-b border-chalk grid items-center gap-3 hover:bg-vellum transition-colors"
                style={{ gridTemplateColumns: "56px 1fr auto" }}
              >
                <div className="flex flex-col">
                  <span className="font-mono text-[12px] font-bold text-char leading-tight">
                    {formatDayLabel(entry.started_at)}
                  </span>
                  <span className="font-mono text-[11px] text-slate leading-tight">
                    {formatTime(entry.started_at)}
                  </span>
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-serif text-[15px] font-medium leading-snug truncate">
                    {formatCategory(entry.category)}
                  </span>
                  <span className="font-sans text-[12px] text-quill truncate">
                    {entry.property?.name ?? "—"}
                  </span>
                </div>
                <span className="font-serif text-[17px] text-plum tabular-nums">
                  {(entry.duration_secs / 3600).toFixed(1)}h
                </span>
              </Link>
            ))
          ) : (
            <div className="px-7 py-10 border-b border-chalk text-center">
              <p className="font-serif text-[17px] text-quill mb-1">
                No activity yet.
              </p>
              <p className="font-sans text-[12px] text-slate">
                Start a timer or log hours manually to see entries here.
              </p>
            </div>
          )}
        </section>
      )}

      {/* ── Dock ────────────────────────────────────────────────── */}
      <Dock />
    </div>
  );
}
