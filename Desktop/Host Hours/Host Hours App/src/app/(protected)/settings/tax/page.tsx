"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";

const targetTests = [
  { id: "500", label: "500 hours", description: "Most common. You must log 500+ hours of material participation." },
  { id: "100", label: "100 hours", description: "You participate 100+ hours and no one else participates more." },
  { id: "substantially", label: "Substantially all", description: "You perform 90%+ of all work on the activity." },
];

export default function TaxSettingsPage() {
  const router = useRouter();
  const [taxYear, setTaxYear] = useState("2026");
  const [targetTest, setTargetTest] = useState("500");
  const [goalHours, setGoalHours] = useState("500");

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings" label="Tax settings" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Tax
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Tax settings.
        </h1>
      </header>

      <form
        className="px-7 py-6 flex flex-col gap-6"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Tax year */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Tax year <span className="text-tangerine">*</span>
          </label>
          <div className="relative">
            <select
              value={taxYear}
              onChange={(e) => setTaxYear(e.target.value)}
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist appearance-none pr-10"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
            </select>
            <svg
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-quill"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </div>
        </div>

        {/* Target test */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3 block">
            Target test <span className="text-tangerine">*</span>
          </label>
          <div className="flex flex-col gap-2">
            {targetTests.map((test) => (
              <button
                key={test.id}
                type="button"
                onClick={() => {
                  setTargetTest(test.id);
                  if (test.id === "500") setGoalHours("500");
                  if (test.id === "100") setGoalHours("100");
                }}
                className={`text-left px-4 py-3.5 rounded-md border transition-colors ${
                  targetTest === test.id
                    ? "border-plum bg-plum-mist"
                    : "border-chalk bg-cream hover:border-plum"
                }`}
              >
                <span className="font-serif text-[16px] font-medium text-char block">
                  {test.label}
                </span>
                <span className="text-[12px] text-slate leading-relaxed">
                  {test.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Annual goal */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Annual goal (hours) <span className="text-tangerine">*</span>
          </label>
          <input
            type="number"
            required
            min="1"
            value={goalHours}
            onChange={(e) => setGoalHours(e.target.value)}
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist tabular-nums"
          />
          <p className="font-sans text-[12px] text-slate mt-2">
            This sets the progress bar target on your dashboard and reports.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <button
            type="submit"
            onClick={() => router.push("/settings")}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all"
          >
            Save changes
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full min-h-12 bg-cream text-quill border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-stone active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
