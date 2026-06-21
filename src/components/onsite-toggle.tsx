"use client";

type Props = {
  /** true = On-site, false = Remote */
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
};

export function OnsiteToggle({ value, onChange, className = "" }: Props) {
  return (
    <div
      className={`inline-flex items-center rounded-full border border-chalk bg-cream p-0.5 ${className}`}
      role="group"
      aria-label="On-site or remote"
    >
      <button
        type="button"
        onClick={() => onChange(true)}
        aria-pressed={value}
        className={`inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
          value ? "bg-plum text-cream" : "text-quill hover:text-plum"
        }`}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        On-site
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        aria-pressed={!value}
        className={`inline-flex items-center gap-1.5 min-h-9 px-3.5 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
          !value ? "bg-plum text-cream" : "text-quill hover:text-plum"
        }`}
      >
        <svg
          className="w-3.5 h-3.5 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 9.5 12 3l9 6.5" />
          <path d="M5 10v10h14V10" />
        </svg>
        Remote
      </button>
    </div>
  );
}
