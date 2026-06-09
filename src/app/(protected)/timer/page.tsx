"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { TaskTypePicker } from "@/components/task-type-picker";
import { PostSaveSheet } from "@/components/post-save-sheet";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos } from "@/lib/photos";

type Property = {
  id: string;
  name: string;
  address: string | null;
};

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

  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [timerId, setTimerId] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);

  const [stoppedEntry, setStoppedEntry] = useState<{
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
      if (!user) {
        router.push("/dashboard");
        return;
      }

      const { data: props } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const allProps = props ?? [];
      setProperties(allProps);

      const { data: existing } = await supabase
        .from("active_timers")
        .select("id, property_id, started_at, title, description, category")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        setTimerId(existing.id);
        setStartedAt(new Date(existing.started_at));
        setSelectedProperty(existing.property_id);
        if (existing.category && existing.category !== "other" && existing.category !== "general_task") {
          setSelectedCategories(
            existing.category
              .split(",")
              .map((c: string) =>
                c
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l: string) => l.toUpperCase()),
              ),
          );
        }
        if (existing.description) setNotes(existing.description);
      } else {
        const pid =
          preselectedPropertyId &&
          allProps.some((p) => p.id === preselectedPropertyId)
            ? preselectedPropertyId
            : allProps[0]?.id ?? null;

        if (pid) {
          setSelectedProperty(pid);
          const { data: newTimer, error: insertError } = await supabase
            .from("active_timers")
            .insert({
              user_id: user.id,
              property_id: pid,
              title: "General Task",
              category: "general_task",
              source: "timer",
            })
            .select("id, started_at")
            .single();

          if (insertError && insertError.code === "23505") {
            const { data: reFetch } = await supabase
              .from("active_timers")
              .select(
                "id, property_id, started_at, title, description, category",
              )
              .eq("user_id", user.id)
              .single();
            if (reFetch) {
              setTimerId(reFetch.id);
              setStartedAt(new Date(reFetch.started_at));
              setSelectedProperty(reFetch.property_id);
                  }
          } else if (insertError) {
            console.error("Failed to create active timer:", insertError);
            setError(`Timer failed to start: ${insertError.message}`);
          } else if (newTimer) {
            setTimerId(newTimer.id);
            setStartedAt(new Date(newTimer.started_at));
          }
        }
      }

      setLoading(false);
    }
    load();
  }, [preselectedPropertyId, router]);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () =>
      setElapsed(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const syncTimer = useCallback(
    async (updates: Record<string, unknown>): Promise<void> => {
      if (!timerId) return;
      const supabase = createClient();
      await supabase
        .from("active_timers")
        .update(updates)
        .eq("id", timerId);
    },
    [timerId],
  );

  function handleCategoryChange(cats: string[]) {
    setSelectedCategories(cats);
    const categoryKey =
      cats.length > 0
        ? cats.map((c) => c.toLowerCase().replace(/[/ ]+/g, "_")).join(",")
        : "general_task";
    const title = cats.length > 0 ? cats.join(", ") : "General Task";
    syncTimer({ category: categoryKey, title });
  }

  useEffect(() => {
    if (!timerId || loading) return;
    const timeout = setTimeout(() => {
      syncTimer({ description: notes.trim() || null });
    }, 800);
    return () => clearTimeout(timeout);
  }, [notes, timerId, loading, syncTimer]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = "";
  }

  async function handleSaveDetails() {
    if (!timerId) return;
    const categoryKey =
      selectedCategories.length > 0
        ? selectedCategories
            .map((c) => c.toLowerCase().replace(/[/ ]+/g, "_"))
            .join(",")
        : "general_task";
    const title =
      selectedCategories.length > 0
        ? selectedCategories.join(", ")
        : "General Task";

    await syncTimer({
      property_id: selectedProperty,
      category: categoryKey,
      title,
      description: notes.trim() || null,
    });

    setDetailsSaved(true);
    setTimeout(() => setDetailsSaved(false), 2000);
  }

  async function handleStop() {
    if (saving || !timerId) return;
    setError(null);
    setSaving(true);

    try {
      const categoryKey =
        selectedCategories.length > 0
          ? selectedCategories
              .map((c) => c.toLowerCase().replace(/[/ ]+/g, "_"))
              .join(",")
          : "general_task";
      const title =
        selectedCategories.length > 0
          ? selectedCategories.join(", ")
          : "General Task";

      const supabase = createClient();
      await supabase
        .from("active_timers")
        .update({
          property_id: selectedProperty,
          category: categoryKey,
          title,
          description: notes.trim() || null,
        })
        .eq("id", timerId)
        .throwOnError();
    } catch {
      // sync failed — stop anyway, details saved are best-effort
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { data: stopped, error: rpcError } = await supabase
      .rpc("stop_timer", {
        p_timer_id: timerId,
        p_user_id: user.id,
      })
      .single() as { data: { id: string; duration_secs: number } | null; error: { message: string } | null };

    if (rpcError) {
      if (rpcError.message.includes("not found")) {
        router.push("/dashboard");
        return;
      }
      setError(rpcError.message);
      setSaving(false);
      return;
    }

    if (photos.length > 0 && stopped) {
      await uploadPhotos(supabase, user.id, stopped.id, photos);
    }

    if (stopped) {
      const hasDetails = selectedCategories.length > 0 || notes.trim().length > 0 || photos.length > 0;
      if (hasDetails) {
        router.push(`/dashboard?saved=${stopped.id}`);
      } else {
        const prop = properties.find((p) => p.id === selectedProperty);
        setStoppedEntry({
          id: stopped.id,
          durationSecs: elapsed > 0 ? elapsed : stopped.duration_secs,
          propertyName: prop?.name ?? "Unknown property",
        });
      }
    } else {
      router.push("/dashboard");
    }
  }

  async function handleDiscard() {
    if (!timerId) return;
    if (!confirm("Discard this timer? Your tracked time will not be saved."))
      return;
    const supabase = createClient();
    await supabase.from("active_timers").delete().eq("id", timerId);
    router.push("/dashboard");
  }

  const property = properties.find((p) => p.id === selectedProperty);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const formatStartedAt = (d: Date) => {
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return (
      d.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " at " +
      d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (stoppedEntry) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <TopStrip backHref="/dashboard" label="Timer" />
        <PostSaveSheet
          timeLogId={stoppedEntry.id}
          durationSecs={stoppedEntry.durationSecs}
          propertyName={stoppedEntry.propertyName}
          onDone={() => router.push("/dashboard")}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <TopStrip backHref="/dashboard" label="Timer" />

      <div className="flex-1 flex flex-col">
        {/* ── Timer hero ── */}
        <div
          className="px-7 py-6 flex flex-col items-center"
          style={{
            background:
              "radial-gradient(ellipse at 50% 30%, var(--plum-mist) 0%, var(--cream) 70%)",
          }}
        >
          <div className="mt-4 mb-2 inline-flex items-center gap-2 px-4 py-2 border border-tangerine rounded-[999px]">
            <span className="w-1.5 h-1.5 rounded-full bg-tangerine animate-pulse-dot" />
            <span className="font-mono text-[11px] uppercase tracking-[1px] text-tangerine font-medium">
              Tracking
            </span>
          </div>

          {property && (
            <p className="font-serif text-[17px] text-char mb-6">
              {property.name}
            </p>
          )}

          <p className="font-serif text-[88px] text-plum tracking-[-5px] tabular-nums leading-none">
            {hh}
            <span className="text-tangerine italic text-[56px] align-[4px]">
              :
            </span>
            {mm}
            <span className="text-tangerine italic text-[56px] align-[4px]">
              :
            </span>
            {ss}
          </p>

          <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-slate text-center mt-3 mb-8">
            Started at{" "}
            <strong className="text-char font-medium">
              {startedAt ? formatStartedAt(startedAt) : "—"}
            </strong>
          </p>

          <button
            type="button"
            onClick={handleStop}
            disabled={saving}
            className="w-24 h-24 rounded-full bg-plum flex items-center justify-center hover:bg-plum-deep active:scale-95 transition-all disabled:opacity-50"
            aria-label="Stop timer"
          >
            <span className="w-6 h-6 bg-cream rounded-[3px]" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill text-center mt-3 mb-2">
            {saving ? "Saving…" : "Stop & save"}
          </span>
        </div>

        {/* ── Metadata form ── */}
        <div className="px-7 py-6 flex flex-col gap-6 border-t border-chalk">
          {error && (
            <div className="px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
              <p className="text-[13px] text-tangerine">{error}</p>
            </div>
          )}

          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              What are you doing?
            </label>
            <TaskTypePicker
              selected={selectedCategories}
              onSelect={handleCategoryChange}
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you work on?"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist resize-none"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Receipts or photos
            </label>

            {photos.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
                {photos.map((photo, i) => (
                  <div
                    key={i}
                    className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden border border-chalk"
                  >
                    <img
                      src={photo.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="absolute top-1 right-1 w-7 h-7 rounded-full bg-char/70 text-cream flex items-center justify-center text-[14px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-4 cursor-pointer hover:border-plum transition-colors">
                <svg
                  className="w-5 h-5 text-quill"
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
                  onChange={handleFileSelect}
                />
              </label>
              <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-4 cursor-pointer hover:border-plum transition-colors">
                <svg
                  className="w-5 h-5 text-quill"
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
                  onChange={handleFileSelect}
                />
              </label>
            </div>

            <p className="mt-2 text-[12px] text-slate">
              Optional. Helpful for documentation.
            </p>
          </div>

          {/* ── Actions ── */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="button"
              onClick={handleSaveDetails}
              className={`w-full min-h-12 font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md transition-all active:scale-[0.98] ${
                detailsSaved
                  ? "bg-plum text-cream"
                  : "bg-cream text-plum border border-plum hover:bg-plum hover:text-cream"
              }`}
            >
              {detailsSaved ? "Saved!" : "Save details"}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              className="w-full min-h-12 font-mono text-[10px] uppercase tracking-[1.5px] text-slate hover:text-tangerine transition-colors"
            >
              Discard timer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
