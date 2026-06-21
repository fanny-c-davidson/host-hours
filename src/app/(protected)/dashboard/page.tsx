"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dock } from "@/components/dock";
import { StartTaskList } from "@/components/start-task-list";
import { GroupedEntryEditor } from "@/components/grouped-entry-editor";
import {
  groupLogs,
  fmtDuration,
  type LogEntry,
} from "@/lib/group-logs";
import { detectNearbyPropertyIds } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";

type Property = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  latitude: number | null;
  longitude: number | null;
  geo_radius_meters: number;
};


export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream pb-24 flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
          <Dock />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();

  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [recentLogs, setRecentLogs] = useState<LogEntry[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<Record<string, number>>({});
  const [entriesLogged, setEntriesLogged] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [nearbyProperties, setNearbyProperties] = useState<Property[]>([]);
  const [geoChecked, setGeoChecked] = useState(false);

  const [activeTimer, setActiveTimer] = useState<{
    id: string;
    startedAt: string;
    propertyName: string;
    propertyId: string;
    taskName: string;
  } | null>(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [miniTimerStarting, setMiniTimerStarting] = useState(false);
  const [miniTimerStopping, setMiniTimerStopping] = useState(false);

  // Recent logs (last 14 days, full fields) for the grouped Recent Activities.
  async function refreshLogs() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const since = new Date();
    since.setDate(since.getDate() - 14);
    since.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("time_logs")
      .select(
        "id, title, started_at, ended_at, duration_secs, description, is_onsite, property_id, property:properties(name)",
      )
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false });
    type Row = {
      id: string;
      title: string;
      started_at: string;
      ended_at: string;
      duration_secs: number;
      description: string | null;
      is_onsite: boolean;
      property_id: string;
      property: { name: string } | null;
    };
    setRecentLogs(
      ((data as Row[] | null) ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_secs: r.duration_secs,
        description: r.description,
        is_onsite: r.is_onsite,
        property_id: r.property_id,
        property_name: r.property?.name ?? null,
      })),
    );
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const fullName =
        profile?.full_name || user.user_metadata?.full_name || "there";
      setUserName(fullName.split(" ")[0]);
      const parts = fullName.split(" ").filter(Boolean);
      setUserInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
          : fullName.substring(0, 2).toUpperCase(),
      );

      const { data: props } = await supabase
        .from("properties")
        .select(
          "id, name, address, color, latitude, longitude, geo_radius_meters",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const allProps = (props ?? []) as Property[];
      setProperties(allProps.slice(0, 3));
      setAllProperties(allProps);

      const { count } = await supabase
        .from("time_logs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null);
      setEntriesLogged(count ?? 0);
      await refreshLogs();

      // Latest activity per property, to order "Recent properties" by recency.
      const { data: actLogs } = await supabase
        .from("time_logs")
        .select("property_id, started_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("started_at", { ascending: false });
      const lastMap: Record<string, number> = {};
      for (const l of actLogs ?? []) {
        if (l.property_id && !(l.property_id in lastMap)) {
          lastMap[l.property_id] = new Date(l.started_at).getTime();
        }
      }
      setLastActivity(lastMap);

      const { data: timerData } = await supabase
        .from("active_timers")
        .select("id, property_id, started_at, title")
        .eq("user_id", user.id)
        .maybeSingle();

      if (timerData) {
        const prop = allProps.find((p) => p.id === timerData.property_id);
        setActiveTimer({
          id: timerData.id,
          startedAt: timerData.started_at,
          propertyName: prop?.name ?? "Unknown property",
          propertyId: timerData.property_id,
          taskName: timerData.title ?? "General Task",
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (allProperties.length === 0 || loading) return;
    let cancelled = false;
    detectNearbyPropertyIds(allProperties).then((ids) => {
      if (cancelled) return;
      setNearbyProperties(allProperties.filter((p) => ids.has(p.id)));
      setGeoChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [allProperties, loading]);

  useEffect(() => {
    if (!activeTimer) return;
    const start = new Date(activeTimer.startedAt).getTime();
    const tick = () =>
      setTimerElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeTimer]);

  async function handleMiniStart(propertyId: string, taskName: string) {
    setMiniTimerStarting(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMiniTimerStarting(false);
      return;
    }

    const { data: newTimer, error } = await supabase
      .from("active_timers")
      .insert({
        user_id: user.id,
        property_id: propertyId,
        title: taskName,
        category: "other",
        source: "timer",
        is_onsite: nearbyProperties.some((p) => p.id === propertyId),
      })
      .select("id, started_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await supabase
          .from("active_timers")
          .select("id, property_id, started_at, title")
          .eq("user_id", user.id)
          .single();
        if (existing) {
          const prop = allProperties.find(
            (p) => p.id === existing.property_id,
          );
          setActiveTimer({
            id: existing.id,
            startedAt: existing.started_at,
            propertyName: prop?.name ?? "Unknown",
            propertyId: existing.property_id,
            taskName: existing.title ?? "General Task",
          });
        }
      }
      setMiniTimerStarting(false);
      return;
    }

    if (newTimer) {
      const prop = allProperties.find((p) => p.id === propertyId);
      setActiveTimer({
        id: newTimer.id,
        startedAt: newTimer.started_at,
        propertyName: prop?.name ?? "Unknown",
        propertyId: propertyId,
        taskName: taskName,
      });
    }
    setMiniTimerStarting(false);
  }

  async function handleMiniStop() {
    if (!activeTimer || miniTimerStopping) return;
    setMiniTimerStopping(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setMiniTimerStopping(false);
      return;
    }

    const { data, error } = (await supabase
      .rpc("stop_timer", {
        p_timer_id: activeTimer.id,
        p_user_id: user.id,
      })
      .single()) as {
      data: { id: string; duration_secs: number; is_onsite: boolean } | null;
      error: unknown;
    };

    // Hand off to the timer page's after-stop view, which shows the just-saved
    // entry (with its already-known task) as an editable card.
    if (data && !error) {
      router.push(`/timer?stopped=${data.id}`);
      return;
    }

    setActiveTimer(null);
    setTimerElapsed(0);
    setMiniTimerStopping(false);
  }

  function formatElapsed(secs: number) {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  const now = new Date();
  const dayName = now.toLocaleDateString("en-US", { weekday: "long" });
  const monthDay = now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  const hour = now.getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  function formatDayLabel(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round(
      (today.getTime() - entryDate.getTime()) / 86400000,
    );
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7)
      return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const hasProperties = properties.length > 0;
  const hasActivity = recentLogs.length > 0;
  const isNewUser = !hasProperties && !hasActivity;
  const recentGroups = groupLogs(recentLogs);
  const timerIsNearby =
    activeTimer &&
    nearbyProperties.some((p) => p.id === activeTimer.propertyId);
  const activeProp = activeTimer
    ? allProperties.find((p) => p.id === activeTimer.propertyId)
    : null;

  const recentProps = allProperties
    .filter((p) => {
      // The running timer's property is already the top tile.
      if (p.id === activeTimer?.propertyId) return false;
      // Nearby properties get their own "You are at" cards — but only while
      // those cards are shown (i.e. no timer running). When a timer is running
      // the cards are hidden, so let nearby properties fall back to this list.
      if (!activeTimer && nearbyProperties.some((np) => np.id === p.id)) {
        return false;
      }
      // "Recent" means actually logged there — exclude properties with no
      // activity (a brand-new account, or assigned-but-never-used properties).
      if ((lastActivity[p.id] ?? 0) === 0) return false;
      return true;
    })
    // Most recently logged first — that's what "recent" means here.
    .sort((a, b) => (lastActivity[b.id] ?? 0) - (lastActivity[a.id] ?? 0));

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
      {/* ── Masthead ──────────────────────────────────────── */}
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

      <div>
        {/* ── Active Running Timer — always the first tile ───── */}
        {activeTimer && (
          <section className="px-7 pt-5 pb-1">
            <div className="rounded-xl bg-plum px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                {timerIsNearby ? (
                  <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-cream/60 font-medium">
                    You are at
                  </p>
                ) : (
                  <span />
                )}
                {!timerIsNearby && (
                  <span
                    className="-mt-1.5 -mr-1.5 p-1.5 text-cream/70 shrink-0"
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="10" x2="14" y1="2" y2="2" />
                      <line x1="12" x2="15" y1="14" y2="11" />
                      <circle cx="12" cy="14" r="8" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="flex items-baseline justify-between gap-3 mt-1">
                <h2 className="font-serif text-[22px] text-cream font-medium leading-snug truncate">
                  {activeProp?.name ?? activeTimer.propertyName}
                </h2>
                <span className="font-serif text-[24px] text-tangerine tabular-nums shrink-0">
                  {formatElapsed(timerElapsed)}
                </span>
              </div>

              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 border border-tangerine/50 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-tangerine animate-pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-tangerine font-medium">
                  {activeTimer.taskName}
                </span>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <button
                  type="button"
                  onClick={handleMiniStop}
                  disabled={miniTimerStopping}
                  className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2 rounded-full bg-cream text-plum hover:bg-cream/90 transition-colors disabled:opacity-50"
                >
                  <span className="w-3 h-3 bg-plum rounded-[2px]" />
                  <span className="font-mono text-[10px] uppercase tracking-[1px] font-medium">
                    {miniTimerStopping ? "Stopping…" : "Stop"}
                  </span>
                </button>
                <Link
                  href="/timer"
                  className="font-mono text-[10px] uppercase tracking-[1px] text-cream/80 underline decoration-tangerine underline-offset-3 min-h-[44px] inline-flex items-center"
                >
                  Add details &rarr;
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ── Nearby Property Cards (start a task) — when idle ── */}
        {!isNewUser &&
          hasProperties &&
          geoChecked &&
          nearbyProperties.length > 0 &&
          !activeTimer && (
            <section className="px-7 pt-5 pb-1">
              {nearbyProperties.map((prop) => (
                <div
                  key={prop.id}
                  className="rounded-xl bg-plum px-5 py-5 mb-4"
                >
                  <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-cream/60 font-medium">
                    You are at
                  </p>
                  <h2 className="font-serif text-[22px] text-cream font-medium leading-snug truncate mt-1">
                    {prop.name}
                  </h2>

                  <div className="mt-4">
                    <StartTaskList
                      onSelect={(name) => handleMiniStart(prop.id, name)}
                      disabled={miniTimerStarting}
                    />
                  </div>
                </div>
              ))}
            </section>
          )}

        {/* ── Welcome / Onboarding (new user) ──────────────── */}
        {isNewUser && (
          <section className="px-7 py-12 border-b border-chalk">
            <span className="font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium">
              Welcome to Host Hours
            </span>
            <h2 className="font-serif text-[36px] font-normal text-plum tracking-[-1.2px] leading-none mt-2 mb-4">
              Let&rsquo;s get started.
            </h2>
            <p className="font-sans text-[14px] text-quill leading-relaxed mb-8">
              Add your first property to start tracking your hosting hours.
              Organized records can help when it&rsquo;s time to work with your
              tax advisor.
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
                    Export a detailed report to share with your tax advisor.
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Recent Properties ─────────────────────────────── */}
        {!isNewUser && hasProperties && geoChecked && recentProps.length > 0 && (
          <section>
            <div className="px-7 py-4 border-b border-chalk">
              <h2 className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate font-medium">
                Recent Properties
              </h2>
            </div>

            {recentProps.slice(0, 3).map((prop) => (
              <div
                key={prop.id}
                className="px-7 py-[18px] border-b border-chalk flex items-center justify-between"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: prop.color }}
                  />
                  <span className="font-serif text-[15px] font-medium text-char truncate">
                    {prop.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Link
                    href={`/timer?property=${prop.id}`}
                    className="font-mono text-[10px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3 min-h-[44px] px-2 inline-flex items-center"
                  >
                    Start timer
                  </Link>
                  <span className="text-chalk">|</span>
                  <Link
                    href="/log"
                    className="font-mono text-[10px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3 min-h-[44px] px-2 inline-flex items-center"
                  >
                    Log hours
                  </Link>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── No nearby — show all properties ──────────────── */}
        {!isNewUser &&
          hasProperties &&
          geoChecked &&
          nearbyProperties.length === 0 &&
          recentProps.length === 0 && (
            <section>
              <div className="px-7 py-4 border-b border-chalk">
                <h2 className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate font-medium">
                  Your Properties
                </h2>
              </div>
              {allProperties.slice(0, 5).map((prop) => (
                <div
                  key={prop.id}
                  className="px-7 py-[18px] border-b border-chalk flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: prop.color }}
                    />
                    <span className="font-serif text-[15px] font-medium text-char truncate">
                      {prop.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/timer?property=${prop.id}`}
                      className="font-mono text-[10px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3 min-h-[44px] px-2 inline-flex items-center"
                    >
                      Start timer
                    </Link>
                    <span className="text-chalk">|</span>
                    <Link
                      href="/log"
                      className="font-mono text-[10px] uppercase tracking-[1px] text-plum underline decoration-tangerine underline-offset-3 min-h-[44px] px-2 inline-flex items-center"
                    >
                      Log hours
                    </Link>
                  </div>
                </div>
              ))}
            </section>
          )}

        {/* ── Recent Activity Section ──────────────────────── */}
        {!isNewUser && (
          <section>
            <div className="px-7 py-4 flex items-center justify-between border-b border-chalk">
              <h2 className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate font-medium">
                Recent Activities
              </h2>
              {entriesLogged > 5 && (
                <Link
                  href="/reports?tab=activity"
                  className="font-mono text-[10px] uppercase tracking-[1px] text-plum min-h-[44px] inline-flex items-center px-2"
                >
                  All &rarr;
                </Link>
              )}
            </div>

            {hasActivity ? (
              recentGroups.slice(0, 5).map((g) => {
                const expanded = expandedKey === g.key;
                const rep = g.entries[0];
                return (
                  <div key={g.key} className="border-b border-chalk">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedKey(expanded ? null : g.key)
                      }
                      aria-expanded={expanded}
                      className="w-full px-7 py-[18px] grid items-center gap-3 text-left hover:bg-vellum transition-colors"
                      style={{ gridTemplateColumns: "72px 1fr auto" }}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-[12px] font-bold text-char leading-tight">
                          {formatDayLabel(rep.started_at)}
                        </span>
                        <span className="font-mono text-[11px] text-slate leading-tight">
                          {formatTime(rep.started_at)}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-serif text-[15px] font-medium leading-snug truncate">
                          {g.title}
                        </span>
                        <span className="font-sans text-[12px] text-quill truncate">
                          {g.propertyName ?? "—"}
                          {g.entries.length > 1 &&
                            ` · ${g.entries.length} sessions`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-serif text-[17px] text-plum tabular-nums">
                          {fmtDuration(g.totalSecs)}
                        </span>
                        <svg
                          className={`w-4 h-4 text-tangerine transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                    </button>
                    {expanded && (
                      <div className="px-7 pb-2">
                        <GroupedEntryEditor group={g} onChanged={refreshLogs} />
                      </div>
                    )}
                  </div>
                );
              })
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
      </div>

      <Dock />
    </div>
  );
}
