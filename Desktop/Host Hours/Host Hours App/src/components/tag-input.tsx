"use client";

import { useState } from "react";

export function TagInput({
  tags,
  onChange,
  allTags = [],
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  allTags?: string[];
}) {
  const [input, setInput] = useState("");

  const unusedTags = allTags.filter((t) => !tags.includes(t));
  const filtered = input.trim()
    ? unusedTags.filter((t) => t.toLowerCase().includes(input.toLowerCase()))
    : unusedTags;

  function addTag(tag?: string) {
    const trimmed = (tag ?? input).trim();
    if (!trimmed || tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInput("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  return (
    <div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-plum-mist text-[13px] text-plum font-medium"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="w-6 h-6 rounded-full bg-plum/20 text-plum flex items-center justify-center text-[13px] leading-none hover:bg-plum/40 transition-colors"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone"
          placeholder="e.g. Downtown, Condo, Beachfront"
        />
        <button
          type="button"
          onClick={() => addTag()}
          disabled={!input.trim()}
          className="min-h-12 px-4 rounded-md border border-chalk text-plum font-mono text-[11px] uppercase tracking-[1px] font-medium hover:border-plum transition-colors disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {filtered.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="inline-flex items-center px-3 py-1.5 rounded-full border border-dashed border-stone text-[13px] text-quill hover:border-plum hover:text-plum transition-colors"
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
