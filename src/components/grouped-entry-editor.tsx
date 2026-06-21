"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { TimePicker } from "@/components/time-picker";
import { OnsiteToggle } from "@/components/onsite-toggle";
import { PhotoUpload } from "@/components/photo-upload";
import { createClient } from "@/lib/supabase/client";
import { uploadPhotos, deletePhoto, MAX_PHOTOS_PER_ENTRY } from "@/lib/photos";
import { localDateKey, toTimeStr, type LogGroup } from "@/lib/group-logs";

type Attachment = {
  id: string;
  storagePath: string;
  fileName: string;
  url: string;
};

/**
 * Editor for a grouped task/day card. Each session's time range is edited
 * individually; Location, Notes, and Photos are shared across the whole group
 * (writes apply to every session). Persists directly and calls `onChanged` so
 * the parent can refresh its combined totals.
 */
export function GroupedEntryEditor({
  group,
  onChanged,
}: {
  group: LogGroup;
  onChanged: () => void;
}) {
  const ids = group.entries.map((e) => e.id);

  const [starts, setStarts] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.entries.map((e) => [e.id, toTimeStr(e.started_at)])),
  );
  const [ends, setEnds] = useState<Record<string, string>>(() =>
    Object.fromEntries(group.entries.map((e) => [e.id, toTimeStr(e.ended_at)])),
  );
  const [date, setDate] = useState(group.dateKey);
  const [onsite, setOnsite] = useState(group.isOnsite);
  const [notes, setNotes] = useState(group.description ?? "");
  const [photos, setPhotos] = useState<Attachment[]>([]);
  const [status, setStatus] = useState<"saving" | "saved" | null>(null);

  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function fetchPhotos(): Promise<Attachment[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from("time_log_photos")
      .select("id, storage_path, file_name")
      .in("time_log_id", ids);
    // Stable, browser-cacheable URLs instead of per-request signed URLs.
    return (data ?? []).map((p) => ({
      id: p.id,
      storagePath: p.storage_path,
      fileName: p.file_name,
      url: `/api/receipt/${p.id}`,
    }));
  }

  useEffect(() => {
    let active = true;
    fetchPhotos().then((p) => {
      if (active) setPhotos(p);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.key]);

  async function runSave(fn: () => Promise<void>) {
    setStatus("saving");
    await fn();
    setStatus("saved");
    setTimeout(() => setStatus((s) => (s === "saved" ? null : s)), 2000);
  }

  async function changeTime(
    entryId: string,
    startedAtIso: string,
    field: "start" | "end",
    value: string,
  ) {
    const nextStarts = field === "start" ? { ...starts, [entryId]: value } : starts;
    const nextEnds = field === "end" ? { ...ends, [entryId]: value } : ends;
    if (field === "start") setStarts(nextStarts);
    else setEnds(nextEnds);

    const startStr = nextStarts[entryId];
    const endStr = nextEnds[entryId];
    if (!startStr || !endStr) return;

    const dateStr = localDateKey(startedAtIso);
    const newStart = new Date(`${dateStr}T${startStr}:00`);
    let newEnd = new Date(`${dateStr}T${endStr}:00`);
    // An end before the start means the session ran past midnight — roll the
    // end to the next day so the duration is positive (instead of clamping to 0).
    if (newEnd.getTime() < newStart.getTime()) {
      newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    const durationSecs = Math.max(
      0,
      Math.floor((newEnd.getTime() - newStart.getTime()) / 1000),
    );

    await runSave(async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({
          started_at: newStart.toISOString(),
          ended_at: newEnd.toISOString(),
          duration_secs: durationSecs,
        })
        .eq("id", entryId);
      onChanged();
    });
  }

  async function changeDate(newDate: string) {
    if (!newDate || newDate === date) return;
    setDate(newDate);
    await runSave(async () => {
      const supabase = createClient();
      // Move every session in the group to the new day, keeping each session's
      // time-of-day (and therefore its duration) intact.
      for (const entry of group.entries) {
        const startStr = starts[entry.id];
        const endStr = ends[entry.id];
        if (!startStr || !endStr) continue;
        const newStart = new Date(`${newDate}T${startStr}:00`);
        let newEnd = new Date(`${newDate}T${endStr}:00`);
        // Sessions that run past midnight: roll the end into the next day.
        if (newEnd.getTime() < newStart.getTime()) {
          newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);
        }
        const durationSecs = Math.max(
          0,
          Math.floor((newEnd.getTime() - newStart.getTime()) / 1000),
        );
        await supabase
          .from("time_logs")
          .update({
            started_at: newStart.toISOString(),
            ended_at: newEnd.toISOString(),
            duration_secs: durationSecs,
          })
          .eq("id", entry.id);
      }
      onChanged();
    });
  }

  async function changeOnsite(value: boolean) {
    setOnsite(value);
    await runSave(async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({ is_onsite: value })
        .in("id", ids);
      onChanged();
    });
  }

  function saveNotes(value: string) {
    runSave(async () => {
      const supabase = createClient();
      await supabase
        .from("time_logs")
        .update({ description: value.trim() || null })
        .in("id", ids);
      onChanged();
    });
  }

  function changeNotes(value: string) {
    setNotes(value);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => saveNotes(value), 800);
  }

  function flushNotes() {
    clearTimeout(noteTimer.current);
    saveNotes(notes);
  }

  async function selectPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    const room = MAX_PHOTOS_PER_ENTRY - photos.length;
    if (files.length === 0 || room <= 0) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const toUpload = files.slice(0, room).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    await runSave(async () => {
      // Attach to the most-recent session in the group.
      await uploadPhotos(ids[0], toUpload);
    });
    setPhotos(await fetchPhotos());
  }

  async function removePhoto(photo: Attachment) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    await runSave(async () => {
      await deletePhoto(photo.id);
    });
  }

  return (
    <div className="pb-4">
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

      {/* Date — applies to the whole group; all sessions move together */}
      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mb-2">
        Date
      </p>
      <input
        type="date"
        value={date}
        onChange={(e) => changeDate(e.target.value)}
        className="w-full min-h-12 px-4 py-3 border border-chalk rounded-md text-[14px] text-char bg-cream focus:outline-none focus:border-plum mb-4"
      />

      {/* One time range per session */}
      {group.entries.map((entry) => (
        <div key={entry.id} className="mb-3 last:mb-0">
          <div className="relative h-[3px] bg-plum/15 rounded-full mx-1.5">
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
              value={starts[entry.id] ?? ""}
              onChange={(v) => changeTime(entry.id, entry.started_at, "start", v)}
            />
            <TimePicker
              value={ends[entry.id] ?? ""}
              onChange={(v) => changeTime(entry.id, entry.started_at, "end", v)}
              align="right"
            />
          </div>
        </div>
      ))}

      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mt-4 mb-2">
        Location
      </p>
      <OnsiteToggle value={onsite} onChange={changeOnsite} />

      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mt-4 mb-2">
        Notes
      </p>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => changeNotes(e.target.value)}
        onBlur={flushNotes}
        placeholder="What did you work on?"
        className="w-full min-h-12 px-4 py-3 border border-chalk rounded-md text-[14px] text-char bg-cream focus:outline-none focus:border-plum resize-none"
      />

      <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill font-medium mt-4 mb-2">
        Receipts or photos
      </p>
      {photos.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-2 mb-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative shrink-0 w-20 h-20 rounded-md overflow-hidden border border-chalk"
            >
              <a href={photo.url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={`${photo.url}?thumb=1`}
                  alt={photo.fileName}
                  fill
                  sizes="80px"
                  unoptimized
                  className="object-cover"
                />
              </a>
              <button
                type="button"
                onClick={() => removePhoto(photo)}
                aria-label={`Remove ${photo.fileName}`}
                className="absolute top-1 right-1 w-7 h-7 rounded-full bg-char/70 text-cream flex items-center justify-center text-[14px] leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {photos.length < MAX_PHOTOS_PER_ENTRY ? (
        <PhotoUpload onChange={selectPhotos} />
      ) : (
        <p className="font-sans text-[12px] text-slate text-center py-2">
          Maximum {MAX_PHOTOS_PER_ENTRY} photos per entry.
        </p>
      )}
    </div>
  );
}
