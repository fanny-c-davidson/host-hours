"use client";

import { useEffect, useRef, useState } from "react";

type Period = "AM" | "PM";

type Props = {
  /** 24-hour "HH:MM" string, or "" when unset */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Which edge the popover aligns to (default "left") */
  align?: "left" | "right";
  /** "sm" = compact inline chip, "md" = full-width form field */
  size?: "sm" | "md";
};

function parse(value: string): { h12: number; m: number; period: Period } {
  if (!value || !value.includes(":")) {
    return { h12: 12, m: 0, period: "AM" };
  }
  const [h, m] = value.split(":").map(Number);
  return {
    h12: h % 12 || 12,
    m: Number.isNaN(m) ? 0 : m,
    period: h >= 12 ? "PM" : "AM",
  };
}

function to24(h12: number, m: number, period: Period): string {
  let h = h12 % 12;
  if (period === "PM") h += 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function display(value: string): string {
  if (!value || !value.includes(":")) return "--:-- --";
  const { h12, m, period } = parse(value);
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: Period[] = ["AM", "PM"];

export function TimePicker({
  value,
  onChange,
  className = "",
  align = "left",
  size = "sm",
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  const { h12, m, period } = parse(value);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Center the selected hour/minute when the popover opens
  useEffect(() => {
    if (!open) return;
    for (const col of [hourColRef.current, minColRef.current]) {
      const sel = col?.querySelector<HTMLElement>("[data-selected='true']");
      if (col && sel) {
        col.scrollTop =
          sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2;
      }
    }
  }, [open]);

  function commit(next: { h12?: number; m?: number; period?: Period }) {
    onChange(
      to24(next.h12 ?? h12, next.m ?? m, next.period ?? period),
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`items-center gap-1.5 border rounded-md text-char bg-cream tabular-nums transition-colors ${
          size === "md"
            ? "flex w-full justify-between min-h-12 px-4 py-3.5 text-[15px]"
            : "inline-flex px-2.5 py-1.5 text-[13px]"
        } ${
          open
            ? "border-plum shadow-[0_0_0_4px] shadow-plum-mist"
            : "border-chalk hover:border-plum"
        } ${className}`}
      >
        <span>{display(value)}</span>
        <svg
          className="w-3.5 h-3.5 text-plum shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-1 flex gap-1 bg-cream border border-chalk rounded-lg shadow-[0_8px_24px_rgba(74,20,140,0.16)] p-1 ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <Column
            ref={hourColRef}
            items={HOURS}
            selected={h12}
            format={(n) => String(n).padStart(2, "0")}
            onPick={(n) => commit({ h12: n })}
          />
          <Column
            ref={minColRef}
            items={MINUTES}
            selected={m}
            format={(n) => String(n).padStart(2, "0")}
            onPick={(n) => commit({ m: n })}
          />
          <div className="flex flex-col gap-0.5 w-12">
            {PERIODS.map((p) => {
              const active = p === period;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => commit({ period: p })}
                  className={`px-2 py-1.5 rounded-md text-[13px] text-center font-medium transition-colors ${
                    active
                      ? "bg-plum text-cream"
                      : "text-char hover:bg-plum-mist"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const Column = ({
  ref,
  items,
  selected,
  format,
  onPick,
}: {
  ref: React.Ref<HTMLDivElement>;
  items: number[];
  selected: number;
  format: (n: number) => string;
  onPick: (n: number) => void;
}) => (
  <div
    ref={ref}
    className="flex flex-col gap-0.5 w-12 max-h-48 overflow-y-auto scrollbar-thin"
  >
    {items.map((n) => {
      const active = n === selected;
      return (
        <button
          key={n}
          type="button"
          data-selected={active}
          onClick={() => onPick(n)}
          className={`shrink-0 px-2 py-1.5 rounded-md text-[13px] text-center tabular-nums transition-colors ${
            active ? "bg-plum text-cream font-medium" : "text-char hover:bg-plum-mist"
          }`}
        >
          {format(n)}
        </button>
      );
    })}
  </div>
);
