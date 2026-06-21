"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos } from "@/lib/photos";

type Property = { id: string; name: string; address: string | null };
type TaskType = { id: string; name: string; sort_order: number };
type TodayLog = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  description: string | null;
  property_id: string;
};

function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatAmPm(timeStr: string): string {
  if (!timeStr) return "--:-- --";
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatClock(secs: number): string {
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function TimerPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-cream flex items-center justify-center">
          <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TimerContent />
    </Suspense>
  );
}

function TimerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPropertyId = searchParams.get("property");
  const preselectedTask = searchParams.get("task");

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTaskName, setActiveTaskName] = useState<string | null>(null);
  const [timerId, setTimerId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeNotes, setActiveNotes] = useState("");
  const [switching, setSwitching] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);

  const [todayLogs, setTodayLogs] = useState<TodayLog[]>([]);
  const [logNotes, setLogNotes] = useState<Record<string, string>>({});
  const [logStartTimes, setLogStartTimes] = useState<Record<string, string>>({});
  const [logEndTimes, setLogEndTimes] = useState<Record<string, string>>({});
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});

  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  const noteTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const activeNoteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/dashboard");
        return;
      }

      const [{ data: props }, { data: types }, { data: existing }] =
        await Promise.all([
          supabase
            .from("properties")
            .select("id, name, address")
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          supabase
            .from("task_types")
            .select("id, name, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("active_timers")
            .select("id, property_id, started_at, title, description")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

      const allProps = props ?? [];
      setProperties(allProps);
      setTaskTypes(types ?? []);

      let pid: string | null = null;

      if (existing) {
        setTimerId(existing.id);
        setStartedAt(new Date(existing.started_at));
        setSelectedProperty(existing.property_id);
        setActiveTaskName(existing.title);
        if (existing.description) setActiveNotes(existing.description);
        pid = existing.property_id;
      } else {
        pid =
          preselectedPropertyId &&
          allProps.some((p) => p.id === preselectedPropertyId)
            ? preselectedPropertyId
            : allProps[0]?.id ?? null;
        setSelectedProperty(pid);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: logs } = await supabase
        .from("time_logs")
        .select(
          "id, title, started_at, ended_at, duration_secs, description, property_id",
        )
        .eq("user_id", user.id)
        .gte("started_at", today.toISOString())
        .is("deleted_at", null)
        .order("started_at", { ascending: false });

      const todayData = (logs ?? []) as TodayLog[];
      setTodayLogs(todayData);

      const nMap: Record<string, string> = {};
      const sMap: Record<string, string> = {};
      const eMap: Record<string, string> = {};
      for (const log of todayData) {
        nMap[log.id] = log.description || "";
        sMap[log.id] = toTimeStr(new Date(log.started_at));
        eMap[log.id] = toTimeStr(new Date(log.ended_at));
      }
      setLogNotes(nMap);
      setLogStartTimes(sMap);
      setLogEndTimes(eMap);

      if (todayData.length > 0) {
        const { data: photoData } = await supabase
          .from("time_log_photos")
          .select("time_log_id")
          .in(
            "time_log_id",
            todayData.map((l) => l.id),
          );
        const counts: Record<string, number> = {};
        for (const p of photoData ?? []) {
          counts[p.time_log_id] = (counts[p.time_log_id] ?? 0) + 1;
        }
        setPhotoCounts(counts);
      }

      if (!existing && preselectedTask && pid) {
        const { data: newTimer, error: insertErr } = await supabase
          .from("active_timers")
          .insert({
            user_id: user.id,
            property_id: pid,
            title: preselectedTask,
            category: "other",
            source: "timer",
          })
          .select("id, started_at")
          .single();
        if (newTimer && !insertErr) {
          setTimerId(newTimer.id);
          setStartedAt(new Date(newTimer.started_at));
          setActiveTaskName(preselectedTask);
        }
      }

      setLoading(false);
    }
    load();
  }, [preselectedPropertyId, preselectedTask, router]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  useEffect(() => {
    if (!timerId || loading) return;
    clearTimeout(activeNoteTimer.current);
    activeNoteTimer.current = setTimeout(async () => {
      const supabase = createClient();
      await supabase
        .from("active_timers")
        .update({ description: activeNotes.trim() || null })
        .eq("id", timerId);
    }, 800);
    return () => clearTimeout(activeNoteTimer.current);
  }, [activeNotes, timerId, loading]);

  async function refreshTodayLogs() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data: logs } = await supabase
      .from("time_logs")
      .select(
        "id, title, started_at, ended_at, duration_secs, description, property_id",
      )
      .eq("user_id", user.id)
      .gte("started_at", today.toISOString())
      .is("deleted_at", null)
      .order("started_at", { ascending: false });
    const todayData = (logs ?? []) as TodayLog[];
    setTodayLogs(todayData);
    const nMap: Record<string, string> = {};
    const sMap: Record<string, string> = {};
    const eMap: Record<string, string> = {};
    for (const log of todayData) {
      nMap[log.id] = log.description || "";
      sMap[log.id] = toTimeStr(new Date(log.started_at));
      eMap[log.id] = toTimeStr(new Date(log.ended_at));
    }
    setLogNotes(nMap);
    setLogStartTimes(sMap);
    setLogEndTimes(eMap);

    if (todayData.length > 0) {
      const { data: photoData } = await supabase
        .from("time_log_photos")
        .select("time_log_id")
        .in(
          "time_log_id",
          todayData.map((l) => l.id),
        );
      const counts: Record<string, number> = {};
      for (const p of photoData ?? []) {
        counts[p.time_log_id] = (counts[p.time_log_id] ?? 0) + 1;
      }
      setPhotoCounts(counts);
    }
  }

  async function stopCurrentTimer(): Promise<{
    id: string;
    duration_secs: number;
  } | null> {
    if (!timerId || !startedAt || !activeTaskName) return null;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    if (activeNotes.trim()) {
      await supabase
        .from("active_timers")
        .update({ description: activeNotes.trim() })
        .eq("id", timerId);
    }

    const { data: stopped } = (await supabase
      .rpc("stop_timer", { p_timer_id: timerId, p_user_id: user.id })
      .single()) as {
      data: { id: string; duration_secs: number } | null;
      error: unknown;
    };

    return stopped ?? null;
  }

  async function saveDetails() {
    if (!timerId) return;
    setSavingDetails(true);
    clearTimeout(activeNoteTimer.current);
    const supabase = createClient();
    await supabase
      .from("active_timers")
      .update({ description: activeNotes.trim() || null })
      .eq("id", timerId);
    router.push("/dashboard");
  }

  async function startTask(taskName: string) {
    if (activeTaskName === taskName || switching || !selectedProperty) return;
    setSwitching(true);

    if (timerId) {
      await stopCurrentTimer();
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setSwitching(false);
      return;
    }

    const { data: newTimer, error: insertErr } = await supabase
      .from("active_timers")
      .insert({
        user_id: user.id,
        property_id: selectedProperty,
        title: taskName,
        category: "other",
        source: "timer",
      })
      .select("id, started_at")
      .single();

    if (insertErr && insertErr.code === "23505") {
      const { data: reFetch } = await supabase
        .from("active_timers")
        .select("id, property_id, started_at, title, description")
        .eq("user_id", user.id)
        .single();
      if (reFetch) {
        setTimerId(reFetch.id);
        setStartedAt(new Date(reFetch.started_at));
        setActiveTaskName(reFetch.title);
        setSelectedProperty(reFetch.property_id);
      }
    } else if (newTimer) {
      setTimerId(newTimer.id);
      setStartedAt(new Date(newTimer.started_at));
      setActiveTaskName(taskName);
      setElapsed(0);
      setActiveNotes("");
    }

    await refreshTodayLogs();
    setSwitching(false);
  }

  async function stopTask() {
    if (!timerId || switching) return;
    setSwitching(true);
    await stopCurrentTimer();
    setTimerId(null);
    setStartedAt(null);
    setActiveTaskName(null);
    setElapsed(0);
    setActiveNotes("");
    await refreshTodayLogs();
    setSwitching(false);
  }

  async function handlePropertyChange(propertyId: string) {
    if (propertyId === selectedProperty) return;
    if (timerId && activeTaskName) {
      setSwitching(true);
      await stopCurrentTimer();
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setSwitching(false);
        return;
      }
      setSelectedProperty(propertyId);
      const { data: newTimer } = await supabase
        .from("active_timers")
        .insert({
          user_id: user.id,
          property_id: propertyId,
          title: activeTaskName,
          category: "other",
          source: "timer",
        })
        .select("id, started_at")
        .single();
      if (newTimer) {
        setTimerId(newTimer.id);
        setStartedAt(new Date(newTimer.started_at));
        setElapsed(0);
        setActiveNotes("");
      }
      await refreshTodayLogs();
      setSwitching(false);
    } else {
      setSelectedProperty(propertyId);
    }
  }

  async function addTaskType() {
    const name = newTaskName.trim();
    if (!name) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const maxOrder =
      taskTypes.length > 0
        ? Math.max(...taskTypes.map((t) => t.sort_order)) + 1
        : 0;
    const { data } = await supabase
      .from("task_types")
      .insert({ user_id: user.id, name, sort_order: maxOrder })
      .select("id, name, sort_order")
      .single();
    if (data) setTaskTypes((prev) => [...prev, data]);
    setNewTaskName("");
    setAddingTask(false);
  }

  function handleLogNoteChange(entryId: string, value: string) {
    setLogNotes((prev) => ({ ...prev, [entryId]: value }));
    clearTimeout(noteTimers.current[entryId]);
    noteTimers.current[entryId] = setTimeout(async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({ description: value.trim() || null })
        .eq("id", entryId);
    }, 800);
  }

  async function handleLogTimeChange(
    entryId: string,
    field: "start" | "end",
    value: string,
  ) {
    const log = todayLogs.find((l) => l.id === entryId);
    if (!log) return;

    if (field === "start") {
      setLogStartTimes((prev) => ({ ...prev, [entryId]: value }));
    } else {
      setLogEndTimes((prev) => ({ ...prev, [entryId]: value }));
    }

    const startStr = field === "start" ? value : logStartTimes[entryId];
    const endStr = field === "end" ? value : logEndTimes[entryId];
    if (!startStr || !endStr) return;

    const logDate = new Date(log.started_at);
    const dateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, "0")}-${String(logDate.getDate()).padStart(2, "0")}`;
    const newStart = new Date(`${dateStr}T${startStr}:00`);
    const newEnd = new Date(`${dateStr}T${endStr}:00`);
    const durationSecs = Math.max(
      0,
      Math.floor((newEnd.getTime() - newStart.getTime()) / 1000),
    );
    if (durationSecs <= 0) return;

    const supabase = createClient();
    await supabase
      .from("time_logs")
      .update({
        started_at: newStart.toISOString(),
        ended_at: newEnd.toISOString(),
        duration_secs: durationSecs,
      })
      .eq("id", entryId);

    setTodayLogs((prev) =>
      prev.map((l) =>
        l.id === entryId
          ? {
              ...l,
              started_at: newStart.toISOString(),
              ended_at: newEnd.toISOString(),
              duration_secs: durationSecs,
            }
          : l,
      ),
    );
  }

  async function handlePhotoSelect(
    entryId: string,
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = "";

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const photos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    await uploadPhotos(supabase, user.id, entryId, photos);

    setPhotoCounts((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? 0) + files.length,
    }));
  }

  const totalTodaySecs =
    todayLogs.reduce((s, l) => s + l.duration_secs, 0) +
    (startedAt ? elapsed : 0);
  const totalHours = totalTodaySecs / 3600;
  const property = properties.find((p) => p.id === selectedProperty);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <TopStrip backHref="/dashboard" label="Timer" />
        <div className="flex-1 flex flex-col items-center justify-center px-7">
          <p className="font-serif text-[22px] text-plum mb-2">
            Add a property first
          </p>
          <p className="font-sans text-[13px] text-quill leading-relaxed mb-6 text-center max-w-[280px]">
            You need at least one property to start tracking hours.
          </p>
          <Link
            href="/properties"
            className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors"
          >
            Add property
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <TopStrip backHref="/dashboard" label="Timer" />

      <div className="flex-1 overflow-y-auto pb-8">
        {/* ── Date + Property Header ───────────────────────── */}
        <div className="px-7 py-4 border-b border-chalk grid grid-cols-2 gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate font-medium">
              Date
            </p>
            <p className="font-serif text-[17px] text-char font-medium mt-0.5">
              TODAY
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate font-medium">
              Property
            </p>
            <p className="font-serif text-[17px] text-char font-medium mt-0.5 truncate">
              {property?.name ?? "—"}
            </p>
          </div>
        </div>

        {/* ── Running: Focused Timer View ─────────────────── */}
        {activeTaskName && startedAt ? (
          <>
            <div className="flex flex-col items-center px-7 pt-8 pb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-tangerine rounded-full mb-2">
                <span className="w-1.5 h-1.5 rounded-full bg-tangerine animate-pulse-dot" />
                <span className="font-mono text-[11px] uppercase tracking-[1px] text-tangerine font-medium">
                  {activeTaskName}
                </span>
              </div>

              <p className="font-serif text-[72px] text-plum tracking-[-3px] tabular-nums leading-none mt-4">
                {formatClock(elapsed)}
              </p>

              <div className="w-full max-w-xs mt-8">
                <div className="relative h-[3px] bg-plum/20 rounded-full mx-1.5">
                  <div className="absolute inset-0 bg-plum rounded-full" />
                  <span
                    className="absolute top-1/2 left-0 w-3 h-3 rounded-full bg-plum border-2 border-cream"
                    style={{ transform: "translate(-50%, -50%)" }}
                  />
                  <span
                    className="absolute top-1/2 right-0 w-3 h-3 rounded-full bg-tangerine border-2 border-cream animate-pulse-dot"
                    style={{ transform: "translate(50%, -50%)" }}
                  />
                </div>
                <div className="flex justify-between mt-2">
                  <span className="font-mono text-[11px] text-slate">
                    {formatAmPm(toTimeStr(startedAt))}
                  </span>
                  <span className="font-mono text-[11px] text-tangerine font-medium">
                    now
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={stopTask}
                disabled={switching}
                className="mt-8 w-20 h-20 rounded-full bg-plum flex items-center justify-center hover:bg-plum-deep active:scale-95 transition-all disabled:opacity-50"
                aria-label="Stop timer"
              >
                <span className="w-5 h-5 bg-cream rounded-[3px]" />
              </button>
              <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill mt-2">
                {switching ? "Saving…" : "Stop"}
              </span>
            </div>

            <div className="px-7 py-5 border-t border-chalk">
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mb-2">
                NOTES / PURPOSE
              </p>
              <textarea
                rows={3}
                value={activeNotes}
                onChange={(e) => setActiveNotes(e.target.value)}
                placeholder="What did you work on?"
                className="w-full min-h-12 px-4 py-3 border border-chalk rounded-md text-[14px] text-char bg-cream focus:outline-none focus:border-plum resize-none"
              />
            </div>

            <div className="px-7 py-5 border-t border-chalk">
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mb-2">
                PHOTOS OR DOCUMENTS
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-3 cursor-pointer hover:border-plum transition-colors">
                  <svg
                    className="w-4 h-4 text-quill"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                  </svg>
                  <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">
                    Gallery
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    disabled
                  />
                </label>
                <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-3 cursor-pointer hover:border-plum transition-colors">
                  <svg
                    className="w-4 h-4 text-quill"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                    <circle cx="12" cy="13" r="3" />
                  </svg>
                  <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">
                    Camera
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled
                  />
                </label>
              </div>
              <p className="mt-2 text-[11px] text-slate">
                Optional. Helpful for documentation.
              </p>
            </div>

            <div className="px-7 py-6">
              <button
                type="button"
                onClick={saveDetails}
                disabled={savingDetails}
                className="w-full py-3.5 rounded-full bg-plum text-cream font-mono text-[12px] uppercase tracking-[1.5px] font-medium hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {savingDetails ? "Saving…" : "Save Details"}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* ── Idle: Start A Task ───────────────────────────── */}
            <div className="px-7 py-5">
              <p className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3">
                Start A Task
              </p>
              <div className="bg-bone/30 rounded-2xl p-4">
                <div className="flex flex-wrap gap-2">
                  {taskTypes.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => startTask(t.name)}
                      disabled={switching}
                      className="min-h-10 px-4 py-2 rounded-full text-[13px] font-medium transition-colors bg-cream border border-chalk text-quill hover:border-plum hover:text-plum disabled:opacity-50"
                    >
                      {t.name}
                    </button>
                  ))}

                  {!addingTask ? (
                    <button
                      type="button"
                      onClick={() => setAddingTask(true)}
                      className="min-h-10 px-4 py-2 border border-dashed border-stone rounded-full text-[13px] font-medium text-stone hover:border-plum hover:text-plum transition-colors"
                    >
                      + Add
                    </button>
                  ) : (
                    <div className="w-full mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        value={newTaskName}
                        onChange={(e) => setNewTaskName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTaskType();
                          }
                          if (e.key === "Escape") {
                            setAddingTask(false);
                            setNewTaskName("");
                          }
                        }}
                        autoFocus
                        placeholder="New task type"
                        className="flex-1 min-h-10 px-3.5 py-2 border border-chalk rounded-md text-[14px] text-char bg-cream focus:outline-none focus:border-plum"
                      />
                      <button
                        type="button"
                        onClick={addTaskType}
                        className="min-h-10 px-4 py-2 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingTask(false);
                          setNewTaskName("");
                        }}
                        className="min-h-10 px-3 py-2 text-[13px] text-quill hover:text-char transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Today's Total ─────────────────────────────────── */}
            {totalHours > 0 && (
              <div className="px-7 py-3 flex justify-between items-center border-t border-b border-chalk">
                <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-slate font-medium">
                  TODAY
                </span>
                <span className="font-serif text-[18px] text-plum font-medium tabular-nums">
                  {totalHours.toFixed(1)}H logged
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
