"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Dock } from "@/components/dock";
import { PostSaveSheet } from "@/components/post-save-sheet";
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

type TaskType = { id: string; name: string; sort_order: number };

type TimeLog = {
  id: string;
  title: string;
  category: string;
  started_at: string;
  duration_secs: number;
  property: { name: string } | null;
};

function haversineMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

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
  const searchParams = useSearchParams();
  const savedEntryId = searchParams.get("saved");

  const [userName, setUserName] = useState("");
  const [userInitials, setUserInitials] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [recentActivity, setRecentActivity] = useState<TimeLog[]>([]);
  const [entriesLogged, setEntriesLogged] = useState(0);
  const [loading, setLoading] = useState(true);
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [nearbyProperties, setNearbyProperties] = useState<Property[]>([]);
  const [geoChecked, setGeoChecked] = useState(false);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);

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
  const [postSaveEntry, setPostSaveEntry] = useState<{
    id: string;
    durationSecs: number;
    propertyName: string;
  } | null>(null);

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

      const [{ data: props }, { data: types }] = await Promise.all([
        supabase
          .from("properties")
          .select(
            "id, name, address, color, latitude, longitude, geo_radius_meters",
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("task_types")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true }),
      ]);

      const allProps = (props ?? []) as Property[];
      setProperties(allProps.slice(0, 3));
      setAllProperties(allProps);
      setTaskTypes(types ?? []);

      const { data: logs, count } = await supabase
        .from("time_logs")
        .select(
          "id, title, category, started_at, duration_secs, property:properties(name)",
          { count: "exact" },
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(5);

      setRecentActivity((logs as TimeLog[] | null) ?? []);
      setEntriesLogged(count ?? 0);

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

    if (!navigator.geolocation) {
      setGeoChecked(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude: userLat, longitude: userLng } = position.coords;
        const nearby = allProperties.filter((p) => {
          if (p.latitude == null || p.longitude == null) return false;
          const dist = haversineMeters(
            userLat,
            userLng,
            p.latitude,
            p.longitude,
          );
          return dist <= p.geo_radius_meters;
        });
        setNearbyProperties(nearby);
        setGeoChecked(true);
      },
      () => {
        setGeoChecked(true);
      },
      { enableHighAccuracy: true, timeout: 5000 },
    );
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
    const capturedElapsed = Math.floor(
      (Date.now() - new Date(activeTimer.startedAt).getTime()) / 1000,
    );
    const capturedName = activeTimer.propertyName;

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
      data: { id: string; duration_secs: number } | null;
      error: unknown;
    };

    if (data && !error) {
      setPostSaveEntry({
        id: data.id,
        durationSecs:
          capturedElapsed > 0 ? capturedElapsed : data.duration_secs,
        propertyName: capturedName,
      });
    }
    setActiveTimer(null);
    setTimerElapsed(0);
    setMiniTimerStopping(false);
  }

  function handlePostSaveDone() {
    setPostSaveEntry(null);
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: logs, count } = await supabase
        .from("time_logs")
        .select(
          "id, title, category, started_at, duration_secs, property:properties(name)",
          { count: "exact" },
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("started_at", { ascending: false })
        .limit(5);
      setRecentActivity((logs as TimeLog[] | null) ?? []);
      setEntriesLogged(count ?? 0);
    })();
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

  function formatCategory(cat: string) {
    return cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  const hasProperties = properties.length > 0;
  const hasActivity = recentActivity.length > 0;
  const isNewUser = !hasProperties && !hasActivity;
  const timerIsNearby =
    activeTimer &&
    nearbyProperties.some((p) => p.id === activeTimer.propertyId);

  const recentProps = allProperties.filter(
    (p) => !nearbyProperties.some((np) => np.id === p.id),
  );

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

      {/* ── Post-Save Sheet ───────────────────────────────── */}
      {postSaveEntry && (
        <PostSaveSheet
          timeLogId={postSaveEntry.id}
          durationSecs={postSaveEntry.durationSecs}
          propertyName={postSaveEntry.propertyName}
          onDone={handlePostSaveDone}
        />
      )}

      <div
        className={
          postSaveEntry ? "opacity-30 pointer-events-none select-none" : ""
        }
      >
        {/* ── Nearby Property Cards with Task Pills ──────── */}
        {!isNewUser &&
          hasProperties &&
          geoChecked &&
          nearbyProperties.length > 0 &&
          !postSaveEntry && (
            <section className="px-7 pt-5 pb-1">
              {nearbyProperties.map((prop) => {
                const isTimerForThis = activeTimer?.propertyId === prop.id;
                const timerRunningElsewhere = activeTimer && !isTimerForThis;

                return (
                  <div
                    key={prop.id}
                    className="rounded-xl bg-plum px-5 py-5 mb-4"
                  >
                    <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-cream/60 font-medium">
                      You are at
                    </p>

                    {isTimerForThis ? (
                      <>
                        <div className="flex items-baseline justify-between gap-3 mt-1">
                          <h2 className="font-serif text-[22px] text-cream font-medium leading-snug truncate">
                            {prop.name}
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
                      </>
                    ) : (
                      <>
                        <h2 className="font-serif text-[22px] text-cream font-medium leading-snug truncate mt-1">
                          {prop.name}
                        </h2>

                        {timerRunningElsewhere ? (
                          <p className="font-mono text-[10px] uppercase tracking-[1px] text-cream/60 mt-4 min-h-[44px] flex items-center">
                            Timer running on {activeTimer.propertyName}
                          </p>
                        ) : (
                          <div className="mt-4">
                            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-cream/60 font-medium mb-3">
                              Start A Task
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {taskTypes.map((t) => (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() =>
                                    handleMiniStart(prop.id, t.name)
                                  }
                                  disabled={miniTimerStarting}
                                  className="min-h-9 px-4 py-2 rounded-full text-[13px] font-medium bg-cream/15 text-cream border border-cream/20 hover:bg-cream/25 transition-colors disabled:opacity-50"
                                >
                                  {t.name}
                                </button>
                              ))}
                              {taskTypes.length === 0 && (
                                <Link
                                  href={`/timer?property=${prop.id}`}
                                  className="min-h-9 px-4 py-2 rounded-full text-[13px] font-medium bg-tangerine text-cream hover:bg-tangerine/90 transition-colors"
                                >
                                  Start timer
                                </Link>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </section>
          )}

        {/* ── Active Timer Banner (when timer not for nearby) ── */}
        {activeTimer && !timerIsNearby && !postSaveEntry && (
          <Link
            href="/timer"
            className="mx-7 mt-5 mb-1 flex items-center gap-4 px-5 py-4 rounded-xl border border-tangerine/40 bg-tangerine/5 hover:bg-tangerine/10 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-tangerine animate-pulse-dot shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
                Timer running
              </p>
              <p className="font-serif text-[15px] text-char truncate">
                {activeTimer.taskName} &middot; {activeTimer.propertyName}{" "}
                &middot;{" "}
                <span className="tabular-nums">
                  {formatElapsed(timerElapsed)}
                </span>
              </p>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[1px] text-plum shrink-0">
              Details &rarr;
            </span>
          </Link>
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

            {recentProps.slice(0, 5).map((prop) => (
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
              recentActivity.map((entry) => (
                <Link
                  key={entry.id}
                  href={`/activity/${entry.id}/edit`}
                  className={`px-7 py-[18px] border-b border-chalk grid items-center gap-3 hover:bg-vellum transition-colors ${
                    savedEntryId === entry.id ? "bg-plum-mist/50" : ""
                  }`}
                  style={{ gridTemplateColumns: "72px 1fr auto" }}
                >
                  <div className="flex flex-col">
                    {savedEntryId === entry.id ? (
                      <span className="font-mono text-[11px] font-medium text-plum leading-tight">
                        Just saved
                      </span>
                    ) : (
                      <span className="font-mono text-[12px] font-bold text-char leading-tight">
                        {formatDayLabel(entry.started_at)}
                      </span>
                    )}
                    <span className="font-mono text-[11px] text-slate leading-tight">
                      {formatTime(entry.started_at)}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-serif text-[15px] font-medium leading-snug truncate">
                      {entry.title || formatCategory(entry.category)}
                    </span>
                    <span className="font-sans text-[12px] text-quill truncate">
                      {entry.property?.name ?? "—"}
                    </span>
                  </div>
                  <span className="font-serif text-[17px] text-plum tabular-nums">
                    {entry.duration_secs < 5400
                      ? `${Math.max(1, Math.ceil(entry.duration_secs / 60))}m`
                      : `${(entry.duration_secs / 3600).toFixed(1)}h`}
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
      </div>

      <Dock />
    </div>
  );
}
