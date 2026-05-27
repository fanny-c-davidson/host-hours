"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { TaskTypePicker } from "@/components/task-type-picker";
import { createClient } from "@/lib/supabase/client";

type Property = {
  id: string;
  name: string;
  address: string | null;
};

export default function TimerPage() {
  const router = useRouter();

  const [phase, setPhase] = useState<"setup" | "running">("setup");
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);

  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("properties")
        .select("id, name, address")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      const props = data ?? [];
      setProperties(props);
      if (props.length > 0) setSelectedProperty(props[0].id);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const startTimer = useCallback(() => {
    setStartTime(new Date());
    setElapsed(0);
    setPhase("running");
  }, []);

  async function stopTimer() {
    if (saving) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !selectedProperty || selectedCategories.length === 0 || !startTime) {
      router.push("/dashboard");
      return;
    }

    const title = selectedCategories.join(", ");
    const categoryKey = selectedCategories.map((c) => c.toLowerCase().replace(/[/ ]+/g, "_")).join(",");

    await supabase.from("time_logs").insert({
      user_id: user.id,
      property_id: selectedProperty,
      title,
      category: categoryKey,
      started_at: startTime.toISOString(),
      duration_secs: elapsed,
      description: notes.trim() || null,
    });

    router.push("/dashboard");
  }

  const property = properties.find((p) => p.id === selectedProperty);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const formatStartTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ── SETUP PHASE ────────────────────────────────────────────────── */
  if (phase === "setup") {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <TopStrip backHref="/dashboard" label="Timer" />

        <div className="flex-1 flex flex-col px-7 py-8">
          <span className="font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium">
            Start timer
          </span>
          <h1 className="font-serif text-[36px] font-normal text-plum tracking-[-1.2px] leading-none mt-2 mb-8">
            Ready to track.
          </h1>

          {/* Property selection */}
          <div className="mb-6">
            <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3">
              Property
            </label>

            {properties.length > 0 ? (
              <div className="flex flex-col gap-2">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProperty(p.id)}
                    className={`text-left px-4 py-3.5 rounded-md border transition-colors ${
                      selectedProperty === p.id
                        ? "border-plum bg-plum-mist"
                        : "border-chalk bg-cream hover:border-plum"
                    }`}
                  >
                    <span className="font-serif text-[16px] font-medium text-char block">
                      {p.name}
                    </span>
                    {p.address && (
                      <span className="text-[12px] text-slate">{p.address}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-quill">
                No properties yet. Add one from the dashboard first.
              </p>
            )}
          </div>

          {/* Activity category */}
          <div className="mb-8">
            <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3">
              What are you doing?
            </label>
            <TaskTypePicker
              selected={selectedCategories}
              onSelect={setSelectedCategories}
            />
          </div>

          {/* Start button */}
          <div className="mt-auto">
            <button
              onClick={startTimer}
              disabled={!selectedProperty || selectedCategories.length === 0}
              className="w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start timer
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── RUNNING PHASE ──────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <TopStrip backHref="/dashboard" label="Timer" />

      <div
        className="flex-1 flex flex-col px-7 py-6"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, var(--plum-mist) 0%, var(--cream) 70%)",
        }}
      >
        {/* Status pill */}
        <div className="self-center mt-6 mb-12 inline-flex items-center gap-2 px-4 py-2 border border-tangerine rounded-[999px]">
          <span className="w-1.5 h-1.5 rounded-full bg-tangerine animate-pulse-dot" />
          <span className="font-mono text-[11px] uppercase tracking-[1px] text-tangerine font-medium">
            Tracking
          </span>
        </div>

        {/* Clock */}
        <div className="text-center">
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
        </div>

        {/* Started at */}
        <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-slate text-center mt-3 mb-12">
          Started at{" "}
          <strong className="text-char font-medium">
            {startTime ? formatStartTime(startTime) : "—"}
          </strong>
        </p>

        {/* Context grid */}
        <div className="grid grid-cols-2 border-y border-chalk py-6 mb-8 gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate">
              Property
            </span>
            <span className="font-serif text-[17px] font-medium text-char">
              {property?.name ?? "—"}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[9px] uppercase tracking-[1.5px] text-slate">
              Activity
            </span>
            <span className="font-serif text-[17px] font-medium text-char">
              {selectedCategories.length > 0 ? selectedCategories.join(", ") : "—"}
            </span>
          </div>
        </div>

        {/* Stop button */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={stopTimer}
            disabled={saving}
            className="w-24 h-24 rounded-full bg-plum flex items-center justify-center hover:bg-plum-deep active:scale-95 transition-all disabled:opacity-50"
            aria-label="Stop timer"
          >
            <span className="w-6 h-6 bg-cream rounded-[3px]" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill text-center">
            {saving ? "Saving…" : "Tap to stop & save"}
          </span>
        </div>

        {/* Quick notes */}
        <div className="mt-auto pt-8">
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Quick notes
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything worth remembering…"
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist resize-none font-sans"
          />
        </div>
      </div>
    </div>
  );
}
