"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PhotoUpload } from "@/components/photo-upload";
import { TopStrip } from "@/components/top-strip";
import { TaskTypePicker } from "@/components/task-type-picker";
import { TimePicker } from "@/components/time-picker";
import { OnsiteToggle } from "@/components/onsite-toggle";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos, MAX_PHOTOS_PER_ENTRY } from "@/lib/photos";

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
  const [onsite, setOnsite] = useState(true);
  const [manualHours, setManualHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_PHOTOS_PER_ENTRY - photos.length;
    if (room <= 0) return;
    const newPhotos = files.slice(0, room).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos((prev) => [...prev, ...newPhotos]);
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

  const timeDuration = calcDuration(startTime, endTime);
  const manualVal = manualHours ? parseFloat(manualHours) : null;
  const hasTimeRange = startTime !== "" && endTime !== "";
  const duration = hasTimeRange ? timeDuration : manualVal;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!propertyId) {
      setError("Please select a property.");
      return;
    }
    if (!duration || duration <= 0) {
      setError(hasTimeRange ? "Please enter a valid time range." : "Please enter a duration.");
      return;
    }
    if (selectedCategories.length === 0) {
      setError("Please pick a task.");
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

    const startedAt = hasTimeRange
      ? new Date(`${date}T${startTime}:00`).toISOString()
      : new Date(`${date}T12:00:00`).toISOString();
    const durationSecs = Math.round(duration * 3600);
    const endedAt = hasTimeRange
      ? new Date(`${date}T${endTime}:00`).toISOString()
      : new Date(new Date(`${date}T12:00:00`).getTime() + durationSecs * 1000).toISOString();
    const title = selectedCategories.length > 0 ? selectedCategories.join(", ") : "General Task";
    const categoryKey = selectedCategories.length > 0
      ? selectedCategories.map((c) => c.toLowerCase().replace(/[/ ]+/g, "_")).join(",")
      : "general_task";

    const { data: inserted, error: insertError } = await supabase
      .from("time_logs")
      .insert({
        user_id: user.id,
        property_id: propertyId,
        title,
        category: categoryKey,
        started_at: startedAt,
        ended_at: endedAt,
        duration_secs: durationSecs,
        description: notes.trim() || null,
        is_onsite: onsite,
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Failed to save entry.");
      setSaving(false);
      return;
    }

    if (photos.length > 0) {
      await uploadPhotos(inserted.id, photos);
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

        {/* Duration */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Duration <span className="text-tangerine">*</span>
          </label>
          <div className="border border-plum rounded-md p-5 bg-cream">
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="0"
                value={hasTimeRange ? (duration ? (duration < 1.5 ? Math.max(1, Math.ceil(duration * 60)).toString() : duration.toFixed(1)) : "") : manualHours}
                onChange={(e) => {
                  if (!hasTimeRange) setManualHours(e.target.value);
                }}
                readOnly={hasTimeRange}
                className={`font-serif text-[32px] text-plum tabular-nums leading-none bg-transparent focus:outline-none w-24 ${hasTimeRange ? "opacity-70" : ""}`}
              />
              <span className="font-serif text-[16px] italic text-quill">
                {hasTimeRange
                  ? (duration && duration < 1.5 ? "min" : "hrs")
                  : "hrs"}
              </span>
            </div>
            {hasTimeRange && (
              <p className="font-sans text-[11px] text-slate mt-1">Calculated from time range below</p>
            )}
          </div>
        </div>

        {/* Time range (optional) */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Time range <span className="text-slate font-normal">(optional)</span>
          </label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div>
              <TimePicker
                size="md"
                value={startTime}
                onChange={(v) => {
                  setStartTime(v);
                  if (v) setManualHours("");
                }}
              />
              <p className="mt-1 font-sans text-[11px] text-slate">hh:mm AM</p>
            </div>
            <span className="text-slate text-[15px] -mt-5">&rarr;</span>
            <div>
              <TimePicker
                size="md"
                align="right"
                value={endTime}
                onChange={(v) => {
                  setEndTime(v);
                  if (v) setManualHours("");
                }}
              />
              <p className="mt-1 font-sans text-[11px] text-slate">hh:mm PM</p>
            </div>
          </div>
          {hasTimeRange && (
            <button
              type="button"
              onClick={() => { setStartTime(""); setEndTime(""); }}
              className="mt-2 font-mono text-[10px] uppercase tracking-[1px] text-slate underline underline-offset-2"
            >
              Clear times
            </button>
          )}
        </div>

        {/* Category */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            What did you do?
          </label>
          <TaskTypePicker
            single
            selected={selectedCategories}
            onSelect={setSelectedCategories}
          />
        </div>

        {/* Location */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Location
          </label>
          <OnsiteToggle value={onsite} onChange={setOnsite} />
        </div>

        {/* Notes */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Notes / Purpose
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What did you work on?"
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist resize-none"
          />
        </div>

        {/* Photos / documents */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Photos or documents
          </label>

          {photos.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
              {photos.map((photo, i) => (
                <div key={i} className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden border border-chalk">
                  <Image
                    src={photo.preview}
                    alt=""
                    fill
                    sizes="80px"
                    unoptimized
                    className="object-cover"
                  />
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

          {photos.length < MAX_PHOTOS_PER_ENTRY ? (
            <PhotoUpload onChange={handleFileSelect} />
          ) : (
            <p className="text-[12px] text-slate text-center py-2">
              Maximum {MAX_PHOTOS_PER_ENTRY} photos per entry.
            </p>
          )}

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
