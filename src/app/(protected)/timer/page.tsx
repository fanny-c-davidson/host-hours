"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { TimePicker } from "@/components/time-picker";
import { OnsiteToggle } from "@/components/onsite-toggle";
import { PhotoUpload } from "@/components/photo-upload";
import { StartTaskList } from "@/components/start-task-list";
import { GroupedEntryEditor } from "@/components/grouped-entry-editor";
import {
  groupLogs,
  fmtDuration,
  toAmPm,
  toTimeStr as isoToTimeStr,
} from "@/lib/group-logs";
import { detectNearbyPropertyIds } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos, MAX_PHOTOS_PER_ENTRY } from "@/lib/photos";

type Property = {
  id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_radius_meters: number;
};
type TodayLog = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  description: string | null;
  property_id: string;
  is_onsite: boolean;
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

// Compact duration: "1m", "48m", "1.3h"
function fmtDur(secs: number): string {
  const mins = Math.max(1, Math.round(secs / 60));
  return mins < 60 ? `${mins}m` : `${(secs / 3600).toFixed(1)}h`;
}

// Spoken duration for the saved banner: "1 min", "48 min", "1.3 hours"
function fmtDurLong(secs: number): string {
  const mins = Math.max(1, Math.round(secs / 60));
  return mins < 60 ? `${mins} min` : `${(secs / 3600).toFixed(1)} hours`;
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
  const stoppedLogParam = searchParams.get("stopped");

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
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

  const [justStoppedId, setJustStoppedId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<
    Record<string, "saving" | "saved">
  >({});

  const [nearbyIds, setNearbyIds] = useState<Set<string>>(new Set());
  const [activeIsOnsite, setActiveIsOnsite] = useState(false);

  // Set when the user navigates here to start a timer for a different property
  // while one is already running — holds the property id they want to switch to.
  const [switchTarget, setSwitchTarget] = useState<string | null>(null);

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

      const [{ data: props }, { data: existing }] = await Promise.all([
        supabase
          .from("properties")
          .select("id, name, address, latitude, longitude, geo_radius_meters")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("active_timers")
          .select(
            "id, property_id, started_at, title, description, is_onsite",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const allProps = (props ?? []) as Property[];
      setProperties(allProps);

      // Detect which properties we're physically at, to default On-site/Remote
      // when a timer starts. Runs in the background; awaited only if we must
      // auto-start a preselected task during load.
      const nearbyPromise = detectNearbyPropertyIds(allProps);
      nearbyPromise.then(setNearbyIds);

      let pid: string | null = null;

      if (existing) {
        setTimerId(existing.id);
        setStartedAt(new Date(existing.started_at));
        setSelectedProperty(existing.property_id);
        setActiveTaskName(existing.title);
        setActiveIsOnsite(existing.is_onsite);
        if (existing.description) setActiveNotes(existing.description);
        pid = existing.property_id;
        // Arrived here to start a different property's timer while one runs —
        // prompt to switch instead of silently showing the running one.
        if (
          preselectedPropertyId &&
          preselectedPropertyId !== existing.property_id
        ) {
          setSwitchTarget(preselectedPropertyId);
        }
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
          "id, title, started_at, ended_at, duration_secs, description, property_id, is_onsite",
        )
        .eq("user_id", user.id)
        .gte("started_at", today.toISOString())
        .is("deleted_at", null)
        .order("started_at", { ascending: false });

      const todayData = (logs ?? []) as TodayLog[];
      setTodayLogs(todayData);

      // Arrived here from a stop elsewhere (e.g. the dashboard) — show the
      // just-saved entry's confirmation for its own property.
      if (stoppedLogParam) {
        const stopped = todayData.find((l) => l.id === stoppedLogParam);
        if (stopped) {
          setJustStoppedId(stoppedLogParam);
          setSelectedProperty(stopped.property_id);
        }
      }

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
        const onsite = (await nearbyPromise).has(pid);
        setActiveIsOnsite(onsite);
        const { data: newTimer, error: insertErr } = await supabase
          .from("active_timers")
          .insert({
            user_id: user.id,
            property_id: pid,
            title: preselectedTask,
            category: "other",
            source: "timer",
            is_onsite: onsite,
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
  }, [preselectedPropertyId, preselectedTask, stoppedLogParam, router]);

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
        "id, title, started_at, ended_at, duration_secs, description, property_id, is_onsite",
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
    setJustStoppedId(null);

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

    const onsite = nearbyIds.has(selectedProperty);
    const { data: newTimer, error: insertErr } = await supabase
      .from("active_timers")
      .insert({
        user_id: user.id,
        property_id: selectedProperty,
        title: taskName,
        category: "other",
        source: "timer",
        is_onsite: onsite,
      })
      .select("id, started_at")
      .single();

    if (insertErr && insertErr.code === "23505") {
      const { data: reFetch } = await supabase
        .from("active_timers")
        .select("id, property_id, started_at, title, description, is_onsite")
        .eq("user_id", user.id)
        .single();
      if (reFetch) {
        setTimerId(reFetch.id);
        setStartedAt(new Date(reFetch.started_at));
        setActiveTaskName(reFetch.title);
        setSelectedProperty(reFetch.property_id);
        setActiveIsOnsite(reFetch.is_onsite);
      }
    } else if (newTimer) {
      setTimerId(newTimer.id);
      setStartedAt(new Date(newTimer.started_at));
      setActiveTaskName(taskName);
      setElapsed(0);
      setActiveNotes("");
      setActiveIsOnsite(onsite);
    }

    await refreshTodayLogs();
    setSwitching(false);
  }

  async function stopTask() {
    if (!timerId || switching) return;
    setSwitching(true);
    const stopped = await stopCurrentTimer();
    setTimerId(null);
    setStartedAt(null);
    setActiveTaskName(null);
    setElapsed(0);
    setActiveNotes("");
    await refreshTodayLogs();
    if (stopped) setJustStoppedId(stopped.id);
    setSwitching(false);
  }

  // Confirmed the switch prompt: stop the running timer and move to the target
  // property's idle view so the user can pick a task to start.
  async function confirmSwitch() {
    if (!switchTarget || switching) return;
    setSwitching(true);
    await stopCurrentTimer();
    setTimerId(null);
    setStartedAt(null);
    setActiveTaskName(null);
    setElapsed(0);
    setActiveNotes("");
    setSelectedProperty(switchTarget);
    await refreshTodayLogs();
    setSwitchTarget(null);
    setSwitching(false);
  }

  function cancelSwitch() {
    setSwitchTarget(null);
  }

  async function setActiveOnsite(value: boolean) {
    setActiveIsOnsite(value);
    if (!timerId) return;
    const supabase = createClient();
    await supabase
      .from("active_timers")
      .update({ is_onsite: value })
      .eq("id", timerId);
  }

  // Run a save while surfacing a per-entry "Saving…" → "Saved" status.
  async function runSave(entryId: string, fn: () => Promise<void>) {
    setSaveStatus((s) => ({ ...s, [entryId]: "saving" }));
    await fn();
    setSaveStatus((s) => ({ ...s, [entryId]: "saved" }));
    setTimeout(() => {
      setSaveStatus((s) => {
        if (s[entryId] !== "saved") return s;
        const next = { ...s };
        delete next[entryId];
        return next;
      });
    }, 2000);
  }

  async function handleLogOnsiteChange(entryId: string, value: boolean) {
    setTodayLogs((prev) =>
      prev.map((l) => (l.id === entryId ? { ...l, is_onsite: value } : l)),
    );
    await runSave(entryId, async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({ is_onsite: value })
        .eq("id", entryId);
    });
  }

  async function saveLogNote(entryId: string, value: string) {
    await runSave(entryId, async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({ description: value.trim() || null })
        .eq("id", entryId);
    });
  }

  function handleLogNoteChange(entryId: string, value: string) {
    setLogNotes((prev) => ({ ...prev, [entryId]: value }));
    clearTimeout(noteTimers.current[entryId]);
    noteTimers.current[entryId] = setTimeout(() => {
      saveLogNote(entryId, value);
    }, 800);
  }

  // Flush the note immediately when the field loses focus, instead of waiting
  // out the debounce.
  function handleLogNoteBlur(entryId: string) {
    clearTimeout(noteTimers.current[entryId]);
    saveLogNote(entryId, logNotes[entryId] ?? "");
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

    await runSave(entryId, async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({
          started_at: newStart.toISOString(),
          ended_at: newEnd.toISOString(),
          duration_secs: durationSecs,
        })
        .eq("id", entryId);
    });

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
    e.target.value = "";
    const room = MAX_PHOTOS_PER_ENTRY - (photoCounts[entryId] ?? 0);
    if (files.length === 0 || room <= 0) return;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const accepted = files.slice(0, room);
    const photos = accepted.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    await runSave(entryId, async () => {
      await uploadPhotos(entryId, photos);
    });

    setPhotoCounts((prev) => ({
      ...prev,
      [entryId]: (prev[entryId] ?? 0) + accepted.length,
    }));
  }

  const totalTodaySecs =
    todayLogs.reduce((s, l) => s + l.duration_secs, 0) +
    (startedAt ? elapsed : 0);
  const property = properties.find((p) => p.id === selectedProperty);
  const atProperty = !!selectedProperty && nearbyIds.has(selectedProperty);
  const switchTargetProp = switchTarget
    ? properties.find((p) => p.id === switchTarget)
    : null;
  const stoppedLog = justStoppedId
    ? todayLogs.find((l) => l.id === justStoppedId) ?? null
    : null;
  const todayGroups = groupLogs(
    todayLogs
      .filter((l) => l.id !== justStoppedId)
      .map((l) => ({
        ...l,
        property_name:
          properties.find((p) => p.id === l.property_id)?.name ?? null,
      })),
  );

  // Editable controls for an entry — time range, location, notes, photos.
  // Everything auto-saves on change, so there's no explicit save button.
  function renderLogBody(log: TodayLog) {
    const count = photoCounts[log.id] ?? 0;
    const status = saveStatus[log.id];
    return (
      <>
        {/* Auto-save status */}
        <div className="flex justify-end items-center h-4 mb-1">
          {status === "saving" ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] text-slate">
              <span className="w-2.5 h-2.5 border border-slate border-t-transparent rounded-full animate-spin" />
              Saving
            </span>
          ) : status === "saved" ? (
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[1px] text-success">
              <svg
                className="w-3 h-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Saved
            </span>
          ) : null}
        </div>

        {/* Start → end span */}
        <div className="relative h-[3px] bg-plum/15 rounded-full mx-1.5 mt-1">
          <div className="absolute inset-0 bg-plum/70 rounded-full" />
          <span
            className="absolute top-1/2 left-0 w-2.5 h-2.5 rounded-full bg-plum border-2 border-cream"
            style={{ transform: "translate(-50%, -50%)" }}
          />
          <span
            className="absolute top-1/2 right-0 w-2.5 h-2.5 rounded-full bg-plum border-2 border-cream"
            style={{ transform: "translate(50%, -50%)" }}
          />
        </div>
        <div className="flex items-center justify-between mt-2.5">
          <TimePicker
            value={logStartTimes[log.id] ?? ""}
            onChange={(v) => handleLogTimeChange(log.id, "start", v)}
          />
          <TimePicker
            value={logEndTimes[log.id] ?? ""}
            onChange={(v) => handleLogTimeChange(log.id, "end", v)}
            align="right"
          />
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mt-4 mb-2">
          Location
        </p>
        <OnsiteToggle
          value={log.is_onsite}
          onChange={(v) => handleLogOnsiteChange(log.id, v)}
        />

        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mt-4 mb-2">
          Notes
        </p>
        <textarea
          rows={2}
          value={logNotes[log.id] ?? ""}
          onChange={(e) => handleLogNoteChange(log.id, e.target.value)}
          onBlur={() => handleLogNoteBlur(log.id)}
          placeholder="What did you work on?"
          className="w-full min-h-12 px-4 py-3 border border-chalk rounded-md text-[14px] text-char bg-cream focus:outline-none focus:border-plum resize-none"
        />

        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mt-4 mb-2">
          Receipts or photos
        </p>
        {count < MAX_PHOTOS_PER_ENTRY ? (
          <PhotoUpload onChange={(e) => handlePhotoSelect(log.id, e)} />
        ) : (
          <p className="text-[12px] text-slate text-center py-2">
            Maximum {MAX_PHOTOS_PER_ENTRY} photos per entry.
          </p>
        )}
        {count > 0 && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[1px] text-success">
            {count} attached
          </p>
        )}
      </>
    );
  }

  // The just-saved confirmation card — always expanded.
  function renderLogCard(log: TodayLog) {
    return (
      <div className="rounded-xl bg-cream p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-char font-medium">
            {log.title}
          </span>
          <span className="font-serif text-[18px] text-plum font-medium tabular-nums">
            {fmtDur(log.duration_secs)}
          </span>
        </div>
        {renderLogBody(log)}
      </div>
    );
  }

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

      {/* ── Switch-timer confirmation ─────────────────────────── */}
      {switchTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-char/40 px-7">
          <div className="bg-cream rounded-2xl p-6 max-w-sm w-full shadow-[0_12px_40px_rgba(74,20,140,0.25)]">
            <p className="font-serif text-[22px] text-plum font-medium tracking-[-0.4px] mb-2">
              Switch timers?
            </p>
            <p className="font-sans text-[14px] text-quill leading-relaxed mb-5">
              A timer is already running for{" "}
              <span className="font-medium text-char">
                {property?.name ?? "another property"}
              </span>
              . Stop it and start a new timer for{" "}
              <span className="font-medium text-char">
                {switchTargetProp?.name ?? "this property"}
              </span>
              ?
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={confirmSwitch}
                disabled={switching}
                className="w-full min-h-12 rounded-md bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {switching
                  ? "Switching…"
                  : `Stop & start ${switchTargetProp?.name ?? "new timer"}`}
              </button>
              <button
                type="button"
                onClick={cancelSwitch}
                disabled={switching}
                className="w-full min-h-12 rounded-md bg-cream text-quill border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium hover:border-stone active:scale-[0.98] transition-all disabled:opacity-50"
              >
                Keep {property?.name ?? "current"} running
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-8">
        {/* ── Date + Property Header (running view only) ────── */}
        {activeTaskName && startedAt && (
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
        )}

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
                Location
              </p>
              <OnsiteToggle value={activeIsOnsite} onChange={setActiveOnsite} />
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
            {/* ── Just Saved: confirm the entry you stopped ────── */}
            {stoppedLog && (
              <>
                <div className="bg-plum px-5 pt-7 pb-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <svg
                        className="w-6 h-6 text-tangerine shrink-0"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <div className="min-w-0">
                        <p className="font-serif text-[26px] font-medium text-cream leading-tight">
                          {fmtDurLong(stoppedLog.duration_secs)} saved
                        </p>
                        <p className="font-sans text-[13px] text-cream/60 mt-0.5 truncate">
                          {property?.name ?? "—"}
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      className="shrink-0 min-h-[44px] inline-flex items-center font-mono text-[10px] uppercase tracking-[1.5px] text-cream/70 hover:text-cream underline decoration-tangerine underline-offset-4 decoration-[1.5px] transition-colors"
                    >
                      Done &rarr;
                    </Link>
                  </div>
                  {renderLogCard(stoppedLog)}
                </div>
              </>
            )}

            {/* ── You Are At: property + start a task ──────────── */}
            <div className="px-7 pt-5 pb-1">
              <div className="rounded-xl bg-plum px-5 py-5">
                {atProperty && (
                  <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-cream/60 font-medium">
                    You are at
                  </p>
                )}
                <h2 className="font-serif text-[22px] text-cream font-medium leading-snug truncate mt-1">
                  {property?.name ?? "—"}
                </h2>

                <div className="mt-4">
                  <StartTaskList onSelect={startTask} disabled={switching} />
                </div>
              </div>
            </div>

            {/* ── Today: total + editable entries ──────────────────
                 Hidden on the initial landing from a property-listing
                 "Start timer" link (?property=…) until a task is stopped. */}
            {todayLogs.length > 0 && (!preselectedPropertyId || justStoppedId) && (
              <div className="px-7 pt-5">
                <div className="flex justify-between items-center pb-3 border-b border-chalk">
                  <span className="font-mono text-[11px] uppercase tracking-[1.5px] text-slate font-medium">
                    Today
                  </span>
                  <span className="font-serif text-[18px] text-plum font-medium tabular-nums">
                    {fmtDur(totalTodaySecs)} logged
                  </span>
                </div>
                <div className="mt-1">
                  {todayGroups.map((g) => {
                    const expanded = expandedLogId === g.key;
                    const rep = g.entries[0];
                    return (
                      <div key={g.key} className="border-b border-chalk">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedLogId(expanded ? null : g.key)
                          }
                          aria-expanded={expanded}
                          className="w-full flex items-center justify-between gap-3 py-3.5 text-left"
                        >
                          <div className="min-w-0">
                            <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-char font-medium truncate">
                              {g.title}
                            </p>
                            <p className="font-sans text-[12px] text-slate mt-1 flex items-center gap-2">
                              <span className="tabular-nums">
                                {g.entries.length > 1
                                  ? `${g.entries.length} sessions`
                                  : `${toAmPm(
                                      isoToTimeStr(rep.started_at),
                                    )} – ${toAmPm(isoToTimeStr(rep.ended_at))}`}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-stone shrink-0" />
                              <span>{g.isOnsite ? "On-site" : "Remote"}</span>
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-serif text-[17px] text-plum font-medium tabular-nums">
                              {fmtDuration(g.totalSecs)}
                            </span>
                            <svg
                              className={`w-3.5 h-3.5 text-tangerine transition-transform ${
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
                          <div className="pb-1">
                            <GroupedEntryEditor
                              group={g}
                              onChanged={refreshTodayLogs}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
