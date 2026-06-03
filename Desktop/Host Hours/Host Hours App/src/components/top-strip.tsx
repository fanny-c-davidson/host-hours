"use client";

import Link from "next/link";

export function TopStrip({
  backHref,
  label,
}: {
  backHref: string;
  label?: string;
}) {
  return (
    <div className="flex items-center justify-between px-7 pt-5 pb-1 shrink-0">
      <Link
        href={backHref}
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
      {label && (
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-slate">
          {label}
        </span>
      )}
    </div>
  );
}
