"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TaskType = { id: string; name: string; sort_order: number };

/**
 * The "Start a task" task-type list, designed for use on a plum card.
 * Renders selectable task pills plus inline management (add, rename, delete,
 * reorder). `onSelect` fires with the task name when a pill is tapped.
 */
export function StartTaskList({
  onSelect,
  disabled = false,
}: {
  onSelect: (name: string) => void;
  disabled?: boolean;
}) {
  const [types, setTypes] = useState<TaskType[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editNames, setEditNames] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("task_types")
        .select("id, name, sort_order")
        .order("sort_order", { ascending: true });
      setTypes(data ?? []);
    }
    load();
  }, []);

  async function addType() {
    const name = newName.trim();
    if (!name) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const maxOrder =
      types.length > 0 ? Math.max(...types.map((t) => t.sort_order)) + 1 : 0;
    const { data } = await supabase
      .from("task_types")
      .insert({ user_id: user.id, name, sort_order: maxOrder })
      .select("id, name, sort_order")
      .single();
    if (data) setTypes((prev) => [...prev, data]);
    setNewName("");
    setAdding(false);
  }

  function handleRenameChange(id: string, value: string) {
    setEditNames((prev) => ({ ...prev, [id]: value }));
  }

  async function commitRename(id: string) {
    const name = (editNames[id] ?? "").trim();
    const current = types.find((t) => t.id === id);
    if (!current || !name || current.name === name) return;
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, name } : t)));
    const supabase = createClient();
    await supabase.from("task_types").update({ name }).eq("id", id);
  }

  async function deleteType(id: string) {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    const supabase = createClient();
    await supabase.from("task_types").delete().eq("id", id);
  }

  async function moveType(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= types.length) return;
    const a = types[index];
    const b = types[target];
    const next = [...types];
    next[index] = { ...b, sort_order: a.sort_order };
    next[target] = { ...a, sort_order: b.sort_order };
    setTypes(next);
    const supabase = createClient();
    await Promise.all([
      supabase
        .from("task_types")
        .update({ sort_order: b.sort_order })
        .eq("id", a.id),
      supabase
        .from("task_types")
        .update({ sort_order: a.sort_order })
        .eq("id", b.id),
    ]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-cream/70 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="10" x2="14" y1="2" y2="2" />
            <line x1="12" x2="15" y1="14" y2="11" />
            <circle cx="12" cy="14" r="8" />
          </svg>
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-cream/60 font-medium">
            Start a task
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditing((v) => !v);
            setAdding(false);
          }}
          className="font-mono text-[10px] uppercase tracking-[1px] text-cream/70 hover:text-cream underline decoration-tangerine underline-offset-2 transition-colors min-h-[44px] py-2"
        >
          {editing ? "Done" : "Edit list"}
        </button>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          {types.map((t, i) => (
            <div key={t.id} className="flex items-center gap-2">
              <div className="flex gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => moveType(i, -1)}
                  disabled={i === 0}
                  aria-label="Move up"
                  className="w-8 h-8 rounded-md bg-cream/10 text-cream/80 flex items-center justify-center text-[14px] leading-none hover:bg-cream/20 disabled:opacity-30 transition-colors"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveType(i, 1)}
                  disabled={i === types.length - 1}
                  aria-label="Move down"
                  className="w-8 h-8 rounded-md bg-cream/10 text-cream/80 flex items-center justify-center text-[14px] leading-none hover:bg-cream/20 disabled:opacity-30 transition-colors"
                >
                  ↓
                </button>
              </div>
              <input
                type="text"
                value={editNames[t.id] ?? t.name}
                onChange={(e) => handleRenameChange(t.id, e.target.value)}
                onBlur={() => commitRename(t.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                className="flex-1 min-w-0 min-h-9 px-3 py-2 rounded-md bg-cream/10 border border-cream/25 text-cream text-[14px] placeholder:text-cream/40 focus:outline-none focus:border-cream/60"
              />
              <button
                type="button"
                onClick={() => deleteType(t.id)}
                aria-label={`Delete ${t.name}`}
                className="w-8 h-8 shrink-0 rounded-full bg-tangerine text-cream flex items-center justify-center text-[16px] leading-none hover:bg-tangerine/90 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
          {types.length === 0 && (
            <p className="font-sans text-[13px] text-cream/60">
              No task types yet.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 items-center">
          {types.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.name)}
              disabled={disabled}
              className="min-h-9 px-4 py-2 rounded-full text-[13px] font-medium bg-cream/15 text-cream border border-cream/20 hover:bg-cream/25 transition-colors disabled:opacity-50"
            >
              {t.name}
            </button>
          ))}

          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="min-h-9 px-4 py-2 border border-dashed border-cream/40 rounded-full text-[13px] font-medium text-cream/80 hover:border-cream hover:text-cream transition-colors"
            >
              + Add
            </button>
          ) : (
            <div className="w-full mt-1 flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addType();
                  }
                  if (e.key === "Escape") {
                    setAdding(false);
                    setNewName("");
                  }
                }}
                autoFocus
                placeholder="New task type"
                className="flex-1 min-w-0 min-h-9 px-3 py-2 rounded-md bg-cream/10 border border-cream/25 text-cream text-[14px] placeholder:text-cream/40 focus:outline-none focus:border-cream/60"
              />
              <button
                type="button"
                onClick={addType}
                className="min-h-9 px-4 py-2 rounded-md text-[13px] font-medium bg-cream text-plum hover:bg-cream/90 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                }}
                className="min-h-9 px-3 py-2 text-[13px] text-cream/70 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
