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
};

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("properties")
        .select("id, name, address, color")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setProperties(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-cream pb-24">
      <div className="flex items-center justify-between px-7 pt-5 pb-1 shrink-0">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[1px] uppercase text-quill hover:text-plum py-2 px-0.5"
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

      <div className="px-7 pt-2 pb-6 border-b border-chalk flex items-baseline justify-between">
        <h1 className="font-serif text-[28px] font-medium text-plum tracking-[-0.6px]">
          Your properties
        </h1>
        <span className="font-mono text-[11px] tracking-[0.5px] text-slate tabular-nums">
          {properties.length} total
        </span>
      </div>

      {loading ? (
        <div className="px-7 py-16 flex justify-center">
          <span className="w-5 h-5 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        </div>
      ) : properties.length > 0 ? (
        <>
          {properties.map((prop) => (
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
                  <div className="flex items-center gap-3 mt-1">
                    <Link
                      href={`/properties/${prop.id}/edit`}
                      className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate hover:text-plum"
                    >
                      Edit
                    </Link>
                    <Link
                      href="/timer"
                      className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px] hover:text-plum-deep"
                    >
                      Start timer
                    </Link>
                    <Link
                      href="/log"
                      className="font-mono text-[10px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px] hover:text-plum-deep"
                    >
                      Log hours
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <div className="px-7 py-5 border-b border-chalk flex justify-center">
            <Link
              href="/properties/new"
              className="font-mono text-[11px] uppercase tracking-[1.5px] text-plum underline decoration-tangerine underline-offset-4 decoration-[1.5px]"
            >
              + Add another property
            </Link>
          </div>
        </>
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
