"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Dock } from "@/components/dock";
import { createClient } from "@/lib/supabase/client";

type Property = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  tags: string[];
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("properties")
        .select("id, name, address, color, tags")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setProperties((data as Property[] | null) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const allTags = Array.from(
    new Set(properties.flatMap((p) => p.tags ?? [])),
  ).sort();

  const filtered = activeTag
    ? properties.filter((p) => (p.tags ?? []).includes(activeTag))
    : properties;

  return (
    <div className="min-h-screen bg-cream pb-24">
      <div className="flex items-center justify-between px-7 pt-5 pb-1 shrink-0">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[1px] uppercase text-quill hover:text-plum min-h-[44px] min-w-[44px] px-2"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="7.5 9 4.5 6 7.5 3" />
          </svg>
          Back
        </Link>
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-slate">
          Properties
        </span>
      </div>

      <div className="px-7 pt-2 pb-4 border-b border-chalk">
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-[28px] font-medium text-plum tracking-[-0.6px]">
            Your properties
          </h1>
          <span className="font-mono text-[11px] tracking-[0.5px] text-slate tabular-nums">
            {filtered.length} {activeTag ? `of ${properties.length}` : "total"}
          </span>
        </div>

        <Link
          href="/properties/new"
          className="inline-flex items-center gap-1.5 mt-3 font-mono text-[11px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px]"
        >
          + Add property
        </Link>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="px-7 py-3 border-b border-chalk flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTag(null)}
            className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
              !activeTag
                ? "bg-plum text-cream"
                : "bg-cream border border-chalk text-quill hover:border-plum"
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`shrink-0 min-h-9 px-3.5 py-2 rounded-full text-[12px] font-medium transition-colors ${
                activeTag === tag
                  ? "bg-plum text-cream"
                  : "bg-cream border border-chalk text-quill hover:border-plum"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="px-7 py-16 flex justify-center">
          <span className="w-5 h-5 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length > 0 ? (
        filtered.map((prop) => (
          <div
            key={prop.id}
            className="px-7 py-[22px] border-b border-chalk flex items-center justify-between hover:bg-vellum transition-colors"
          >
            <div className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ background: prop.color }}
              />
              <div className="flex flex-col gap-1">
                <span className="font-serif text-[19px] font-medium text-char tracking-[-0.3px]">
                  {prop.name}
                </span>
                {prop.address && (
                  <span className="font-sans text-[12px] text-slate">
                    {prop.address}
                  </span>
                )}
                {prop.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {prop.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-plum-mist text-[11px] text-plum font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1">
                  <Link
                    href={`/properties/${prop.id}/edit`}
                    className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate hover:text-plum min-h-[44px] px-2 inline-flex items-center"
                  >
                    Edit
                  </Link>
                  <Link
                    href={`/timer?property=${prop.id}`}
                    className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px] hover:text-plum-deep min-h-[44px] px-2 inline-flex items-center"
                  >
                    Start timer
                  </Link>
                  <Link
                    href="/log"
                    className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px] hover:text-plum-deep min-h-[44px] px-2 inline-flex items-center"
                  >
                    Log hours
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ))
      ) : properties.length > 0 ? (
        <div className="px-7 py-16 text-center">
          <p className="font-serif text-[18px] text-quill">
            No properties match &ldquo;{activeTag}&rdquo;
          </p>
        </div>
      ) : (
        <div className="px-7 py-16 text-center">
          <p className="font-serif text-[22px] text-plum mb-2">
            No properties yet
          </p>
          <p className="font-sans text-[13px] text-quill leading-relaxed mb-8 max-w-[280px] mx-auto">
            Add your first rental property to start tracking hours and working
            toward your tax goal.
          </p>
          <Link
            href="/properties/new"
            className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors"
          >
            Add your first property
          </Link>
        </div>
      )}

      <Dock />
    </div>
  );
}
