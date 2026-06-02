"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { TaskTypePicker } from "@/components/task-type-picker";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos } from "@/lib/photos";

type Property = {
  id: string;
  name: string;
  address: string | null;
};

export default function TimerPage() {
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
  const [propertyPickerOpen, setPropertyPickerOpen] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    setStartTime(new Date());
  }, []);

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

      if (preselectedPropertyId && props.some((p) => p.id === preselectedPropertyId)) {
        setSelectedProperty(preselectedPropertyId);
      } else if (props.length > 0) {
        setSelectedProperty(props[0].id);
      }

      setLoading(false);
    }
    load();
  }, [preselectedPropertyId]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = "";
  }

  async function stopTimer() {
    if (saving) return;
    setError(null);

    if (!selectedProperty) {
      setError("Please select a property.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Please select at least one activity.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/dashboard");
      return;
    }

    const title = selectedCategories.join(", ");
    const categoryKey = selectedCategories
      .map((c) => c.toLowerCase().replace(/[/ ]+/g, "_"))
      .join(",");

    const { data: inserted, error: insertError } = await supabase
      .from("time_logs")
      .insert({
        user_id: user.id,
        property_id: selectedProperty,
        title,
        category: categoryKey,
        started_at: startTime!.toISOString(),
        duration_secs: elapsed,
        description: notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Failed to save.");
      setSaving(false);
      return;
    }

    if (photos.length > 0) {
      await uploadPhotos(supabase, user.id, inserted.id, photos);
    }

    router.push("/dashboard");
  }

  const property = properties.find((p) => p.id === selectedProperty);

  const hh = String(Math.floor(elapsed / 3600)).padStart(2, "0");
  const mm = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
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
          {/* Status pill */}
          <div className="mt-4 mb-8 inline-flex items-center gap-2 px-4 py-2 border border-tangerine rounded-[999px]">
            <span className="w-1.5 h-1.5 rounded-full bg-tangerine animate-pulse-dot" />
            <span className="font-mono text-[11px] uppercase tracking-[1px] text-tangerine font-medium">
              Tracking
            </span>
          </div>

          {/* Clock */}
          <p className="font-serif text-[88px] text-plum tracking-[-5px] tabular-nums leading-none">
            {hh}
            <span className="text-tangerine italic text-[56px] align-[4px]">:</span>
            {mm}
            <span className="text-tangerine italic text-[56px] align-[4px]">:</span>
            {ss}
          </p>

          {/* Started at */}
          <p className="font-mono text-[11px] uppercase tracking-[1.5px] text-slate text-center mt-3 mb-8">
            Started at{" "}
            <strong className="text-char font-medium">{startTime ? formatTime(startTime) : "—"}</strong>
          </p>

          {/* Stop button */}
          <button
            type="button"
            onClick={stopTimer}
            disabled={saving}
            className="w-24 h-24 rounded-full bg-plum flex items-center justify-center hover:bg-plum-deep active:scale-95 transition-all disabled:opacity-50"
            aria-label="Stop timer"
          >
            <span className="w-6 h-6 bg-cream rounded-[3px]" />
          </button>
          <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill text-center mt-3 mb-2">
            {saving ? "Saving…" : "Tap to stop & save"}
          </span>
        </div>

        {/* ── Metadata form ── */}
        <div className="px-7 py-6 flex flex-col gap-6 border-t border-chalk">
          {error && (
            <div className="px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
              <p className="text-[13px] text-tangerine">{error}</p>
            </div>
          )}

          {/* Property — tappable display */}
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Property
            </label>
            <button
              type="button"
              onClick={() => setPropertyPickerOpen(!propertyPickerOpen)}
              className="w-full text-left px-4 py-3.5 rounded-md border border-chalk bg-cream hover:border-plum transition-colors flex items-center justify-between"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-serif text-[16px] font-medium text-char">
                  {property?.name ?? "Select a property"}
                </span>
                {property?.address && (
                  <span className="text-[12px] text-slate">{property.address}</span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-quill transition-transform ${propertyPickerOpen ? "rotate-180" : ""}`}
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="4 6 8 10 12 6" />
              </svg>
            </button>

            {propertyPickerOpen && (
              <div className="mt-2 flex flex-col gap-2">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedProperty(p.id);
                      setPropertyPickerOpen(false);
                    }}
                    className={`text-left px-4 py-3 rounded-md border transition-colors ${
                      selectedProperty === p.id
                        ? "border-plum bg-plum-mist"
                        : "border-chalk bg-cream hover:border-plum"
                    }`}
                  >
                    <span className="font-serif text-[15px] font-medium text-char block">
                      {p.name}
                    </span>
                    {p.address && (
                      <span className="text-[12px] text-slate">{p.address}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              What are you doing?
            </label>
            <TaskTypePicker
              selected={selectedCategories}
              onSelect={setSelectedCategories}
            />
          </div>

          {/* Notes */}
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

          {/* Receipts / photos */}
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Receipts or photos
            </label>

            {photos.length > 0 && (
              <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden border border-chalk">
                    <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-char/70 text-cream flex items-center justify-center text-[11px] leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-4 cursor-pointer hover:border-plum transition-colors">
                <svg className="w-5 h-5 text-quill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
                <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">Gallery</span>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
              </label>
              <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-4 cursor-pointer hover:border-plum transition-colors">
                <svg className="w-5 h-5 text-quill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                  <circle cx="12" cy="13" r="3" />
                </svg>
                <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">Camera</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
              </label>
            </div>

            <p className="mt-2 text-[12px] text-slate">
              Optional. Audit-helpful.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
