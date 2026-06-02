"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { TaskTypePicker } from "@/components/task-type-picker";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos, deletePhoto, getSignedUrls } from "@/lib/photos";

type Property = {
  id: string;
  name: string;
  address: string | null;
};

function calcDuration(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  return diff > 0 ? diff / 60 : null;
}

function toTimeStr(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default function EditActivityPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; storagePath: string; fileName: string; url: string }[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ file: File; preview: string }[]>([]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const added = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setNewPhotos((prev) => [...prev, ...added]);
    e.target.value = "";
  }

  async function handleRemoveExisting(photoId: string, storagePath: string) {
    const supabase = createClient();
    await deletePhoto(supabase, photoId, storagePath);
    setExistingPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [{ data: props }, { data: entry }, { data: photoRows }] = await Promise.all([
        supabase
          .from("properties")
          .select("id, name, address")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("time_logs")
          .select("*")
          .eq("id", id)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("time_log_photos")
          .select("id, storage_path, file_name")
          .eq("time_log_id", id),
      ]);

      setProperties(props ?? []);

      if (!entry) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      if (photoRows && photoRows.length > 0) {
        const signed = await getSignedUrls(supabase, photoRows);
        setExistingPhotos(signed);
      }

      setPropertyId(entry.property_id);

      const started = new Date(entry.started_at);
      setDate(toDateStr(started));
      setStartTime(toTimeStr(started));

      const durationSecs = entry.duration_secs ?? 0;
      const ended = new Date(started.getTime() + durationSecs * 1000);
      setEndTime(toTimeStr(ended));

      const cats = entry.title ? entry.title.split(", ").filter(Boolean) : [];
      setSelectedCategories(cats);

      setNotes(entry.description || "");
      setLoading(false);
    }
    load();
  }, [id]);

  const duration = calcDuration(startTime, endTime);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
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

    const startedAt = new Date(`${date}T${startTime}:00`).toISOString();
    const durationSecs = Math.round(duration * 3600);
    const title = selectedCategories.join(", ");
    const categoryKey = selectedCategories.map((c) => c.toLowerCase().replace(/[/ ]+/g, "_")).join(",");

    const supabaseForUser = createClient();
    const { data: { user } } = await supabaseForUser.auth.getUser();

    const { error: updateError } = await supabase
      .from("time_logs")
      .update({
        property_id: propertyId,
        title,
        category: categoryKey,
        started_at: startedAt,
        duration_secs: durationSecs,
        description: notes.trim() || null,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    if (newPhotos.length > 0 && user) {
      await uploadPhotos(supabase, user.id, id, newPhotos);
    }

    router.push("/dashboard");
  }

  async function handleDelete() {
    setDeleting(true);
    const supabase = createClient();

    await supabase
      .from("time_logs")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    router.push("/dashboard");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <TopStrip backHref="/dashboard" label="Edit entry" />
        <div className="flex-1 flex items-center justify-center px-7">
          <p className="font-serif text-[18px] text-quill">Entry not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/dashboard" label="Edit entry" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Edit entry
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Update hours.
        </h1>
      </header>

      <form className="px-7 py-6 flex flex-col gap-6" onSubmit={handleSave}>
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

          {(existingPhotos.length > 0 || newPhotos.length > 0) && (
            <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
              {existingPhotos.map((photo) => (
                <div key={photo.id} className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden border border-chalk">
                  <img src={photo.url} alt={photo.fileName} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemoveExisting(photo.id, photo.storagePath)}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-char/70 text-cream flex items-center justify-center text-[11px] leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
              {newPhotos.map((photo, i) => (
                <div key={`new-${i}`} className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden border border-chalk">
                  <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setNewPhotos((prev) => prev.filter((_, j) => j !== i))}
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

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full min-h-12 bg-cream text-quill border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-stone active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="w-full min-h-12 bg-cream text-tangerine border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-tangerine active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete entry"}
          </button>
        </div>
      </form>
    </div>
  );
}
