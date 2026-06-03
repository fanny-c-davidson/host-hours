"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { TaskTypePicker } from "@/components/task-type-picker";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos } from "@/lib/photos";

type Property = {
  id: string;
  name: string;
  address: string | null;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function calcDuration(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff / 60 : null;
}

export default function LogPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = "";
  }

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
      if (props.length > 0) setPropertyId(props[0].id);
      setLoading(false);
    }
    load();
  }, []);

  const duration = calcDuration(startTime, endTime);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!propertyId) {
      setError("Please select a property.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Please select at least one category.");
      return;
    }
    if (!duration || duration <= 0) {
      setError("Please enter a valid time range.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setSaving(false);
      return;
    }

    const startedAt = new Date(`${date}T${startTime}:00`).toISOString();
    const durationSecs = Math.round(duration * 3600);
    const title = selectedCategories.join(", ");
    const categoryKey = selectedCategories.map((c) => c.toLowerCase().replace(/[/ ]+/g, "_")).join(",");

    const { data: inserted, error: insertError } = await supabase
      .from("time_logs")
      .insert({
        user_id: user.id,
        property_id: propertyId,
        title,
        category: categoryKey,
        started_at: startedAt,
        duration_secs: durationSecs,
        description: notes.trim() || null,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Failed to save entry.");
      setSaving(false);
      return;
    }

    if (photos.length > 0) {
      await uploadPhotos(supabase, user.id, inserted.id, photos);
    }

    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/dashboard" label="Log" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Manual entry
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Log hours.
        </h1>
      </header>

      <form className="px-7 py-6 flex flex-col gap-6" onSubmit={handleSubmit}>
        {error && (
          <div className="px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
            <p className="text-[13px] text-tangerine">{error}</p>
          </div>
        )}

        {/* Property */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Property <span className="text-tangerine">*</span>
          </label>
          <div className="relative">
            <select
              required
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist appearance-none pr-10"
            >
              <option value="" disabled>
                Select a property
              </option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.address ? ` — ${p.address}` : ""}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-quill"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>
        </div>

        {/* Date */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Date <span className="text-tangerine">*</span>
          </label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist"
          />
        </div>

        {/* Time worked */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Time worked
          </label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist"
            />
            <span className="text-slate text-[15px]">&rarr;</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist"
            />
          </div>

          {/* Duration callout */}
          <div className="mt-3 border border-plum rounded-md p-5 bg-cream flex justify-between items-baseline">
            <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">
              Duration
            </span>
            <span className="font-serif text-[32px] text-plum tabular-nums leading-none">
              {duration ? duration.toFixed(1) : "—"}{" "}
              <span className="text-[16px] italic text-quill">hrs</span>
            </span>
          </div>
        </div>

        {/* Category */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            What did you do? <span className="text-tangerine">*</span>
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
            rows={3}
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
              <svg className="w-5 h-5 text-quill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">Gallery</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>

            <label className="flex items-center justify-center gap-2 border border-dashed border-stone rounded-md p-4 cursor-pointer hover:border-plum transition-colors">
              <svg className="w-5 h-5 text-quill" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium">Camera</span>
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

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save entry"}
        </button>
      </form>
    </div>
  );
}
