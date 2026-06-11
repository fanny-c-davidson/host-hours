"use client";

type Property = { id: string; name: string; tags: string[] };

const PILL_ACTIVE = "bg-plum text-cream border border-plum";
const PILL_INACTIVE = "border border-chalk text-quill hover:border-plum";

export function PropertyFilter({
  properties,
  allTags,
  activeTag,
  activeProp,
  onTagChange,
  onPropChange,
  cohostName,
  showCombined,
  onToggleCombined,
}: {
  properties: Property[];
  allTags: string[];
  activeTag: string | null;
  activeProp: string;
  onTagChange: (tag: string | null) => void;
  onPropChange: (prop: string) => void;
  cohostName?: string | null;
  showCombined?: boolean;
  onToggleCombined?: () => void;
}) {
  const tagFiltered = activeTag
    ? properties.filter((p) => (p.tags ?? []).includes(activeTag))
    : properties;

  if (properties.length <= 1 && allTags.length === 0) return null;

  return (
    <div className="border-b border-chalk py-4 flex flex-col gap-3">
      {/* Tag row */}
      {allTags.length > 0 && (
        <div className="px-7 flex gap-2 overflow-x-auto">
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[1.5px] text-slate font-medium self-center mr-1">
            Tags
          </span>
          <button
            type="button"
            onClick={() => onTagChange(null)}
            className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
              !activeTag ? PILL_ACTIVE : PILL_INACTIVE
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onTagChange(activeTag === tag ? null : tag)}
              className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
                activeTag === tag ? PILL_ACTIVE : PILL_INACTIVE
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Property row */}
      {tagFiltered.length > 0 && (
        <div className="px-7 flex gap-2 overflow-x-auto">
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[1.5px] text-slate font-medium self-center mr-1">
            Property
          </span>
          <button
            type="button"
            onClick={() => onPropChange("All properties")}
            className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
              activeProp === "All properties" ? PILL_ACTIVE : PILL_INACTIVE
            }`}
          >
            All properties
          </button>
          {tagFiltered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPropChange(p.name)}
              className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
                activeProp === p.name ? PILL_ACTIVE : PILL_INACTIVE
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Spouse toggle */}
      {cohostName && onToggleCombined && (
        <div className="px-7 flex gap-2 items-center">
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[1.5px] text-slate font-medium mr-1">
            Spouse
          </span>
          <button
            type="button"
            onClick={onToggleCombined}
            className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
              showCombined ? PILL_ACTIVE : PILL_INACTIVE
            }`}
          >
            Add {cohostName}&rsquo;s hours
          </button>
        </div>
      )}
    </div>
  );
}
