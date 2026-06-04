"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TaskType = {
  id: string;
  name: string;
  sort_order: number;
};

export function TaskTypePicker({
  selected,
  onSelect,
}: {
  selected: string[];
  onSelect: (names: string[]) => void;
}) {
  const [types, setTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    loadTypes();
  }, []);

  async function loadTypes() {
    const supabase = createClient();
    const { data } = await supabase
      .from("task_types")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true });

    setTypes(data ?? []);
    setLoading(false);
  }

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const maxOrder = types.length > 0 ? Math.max(...types.map((t) => t.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from("task_types")
      .insert({ user_id: user.id, name, sort_order: maxOrder })
      .select("id, name, sort_order")
      .single();

    if (error) return;
    if (data) setTypes((prev) => [...prev, data]);
    setNewName("");
    setAdding(false);
  }

  async function handleDelete(id: string, name: string) {
    if (selected.includes(name)) onSelect(selected.filter((s) => s !== name));
    const supabase = createClient();
    await supabase.from("task_types").delete().eq("id", id);
    setTypes((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <span className="w-4 h-4 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-slate">Loading…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {types.map((t) => {
          const active = selected.includes(t.name);
          return (
            <div key={t.id} className="relative group">
              <button
                type="button"
                onClick={() => {
                  if (editMode) return;
                  if (active) {
                    onSelect(selected.filter((s) => s !== t.name));
                  } else {
                    onSelect([...selected, t.name]);
                  }
                }}
                className={`min-h-9 px-3.5 py-2 rounded-[999px] text-[13px] font-medium transition-colors ${
                  active && !editMode
                    ? "bg-plum border-plum text-cream"
                    : "border border-chalk text-quill hover:border-plum hover:text-plum"
                } ${editMode ? "pr-8" : ""}`}
              >
                {t.name}
              </button>
              {editMode && (
                <button
                  type="button"
                  onClick={() => handleDelete(t.id, t.name)}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-tangerine text-cream flex items-center justify-center text-[13px] font-bold leading-none"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}

        {!editMode && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="min-h-9 px-3.5 py-2 border border-dashed border-stone rounded-[999px] text-[13px] font-medium text-stone hover:border-plum hover:text-plum transition-colors"
          >
            + Add
          </button>
        )}
      </div>

      {adding && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleAdd(); }
              if (e.key === "Escape") { setAdding(false); setNewName(""); }
            }}
            autoFocus
            placeholder="New task type"
            className="flex-1 min-h-10 px-3.5 py-2 border border-chalk rounded-md text-[14px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="min-h-10 px-4 py-2 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => { setAdding(false); setNewName(""); }}
            className="min-h-10 px-3 py-2 rounded-md text-[13px] text-quill hover:text-char transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-2.5">
        <button
          type="button"
          onClick={() => { setEditMode(!editMode); setAdding(false); }}
          className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate hover:text-plum transition-colors min-h-[44px] py-2"
        >
          {editMode ? "Done editing" : "Edit list"}
        </button>
      </div>
    </div>
  );
}
