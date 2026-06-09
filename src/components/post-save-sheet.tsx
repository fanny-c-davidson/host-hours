"use client";

import { useState } from "react";
import { TaskTypePicker } from "@/components/task-type-picker";
import { createClient } from "@/lib/supabase/client";

type Props = {
  timeLogId: string;
  durationSecs: number;
  propertyName: string;
  onDone: () => void;
};

export function PostSaveSheet({
  timeLogId,
  durationSecs,
  propertyName,
  onDone,
}: Props) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const title =
      selectedCategories.length > 0
        ? selectedCategories.join(", ")
        : "General Task";
    const categoryKey =
      selectedCategories.length > 0
        ? selectedCategories
            .map((c) => c.toLowerCase().replace(/[/ ]+/g, "_"))
            .join(",")
        : "general_task";

    await supabase
      .from("time_logs")
      .update({
        title,
        category: categoryKey,
        ...(notes.trim() ? { description: notes.trim() } : {}),
      })
      .eq("id", timeLogId);

    onDone();
  }

  const durationLabel = durationSecs < 5400
    ? `${Math.max(1, Math.ceil(durationSecs / 60))} min`
    : `${(durationSecs / 3600).toFixed(1)} hours`;

  return (
    <section>
      <div className="bg-plum px-7 py-8">
        <div className="flex items-center gap-3">
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
          <div>
            <p className="font-serif text-[28px] font-medium text-cream leading-tight">
              {durationLabel} saved
            </p>
            <p className="font-sans text-[13px] text-cream/60 mt-0.5">{propertyName}</p>
          </div>
        </div>
      </div>

      <div className="px-7 py-6 flex flex-col gap-4">
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            What did you do?
          </label>
          <TaskTypePicker
            selected={selectedCategories}
            onSelect={setSelectedCategories}
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

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save details"}
          </button>
          <button
            type="button"
            onClick={onDone}
            className="min-h-12 px-6 bg-cream text-quill border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-stone active:scale-[0.98] transition-all"
          >
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
