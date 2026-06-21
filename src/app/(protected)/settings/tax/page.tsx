"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

const targetTests = [
  { id: "500", label: "500 hours", description: "Generally requires 500+ hours of participation. Consult your tax advisor." },
  { id: "100", label: "100 hours", description: "Generally requires 100+ hours and that no one else participates more." },
  { id: "substantially", label: "Substantially all", description: "Generally requires performing substantially all work on the activity." },
];

export default function TaxSettingsPage() {
  const router = useRouter();
  const [taxYear, setTaxYear] = useState("2026");
  const [targetTest, setTargetTest] = useState("500");
  const [goalHours, setGoalHours] = useState("500");
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [years, setYears] = useState<string[]>(["2026"]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("tax_year, target_test, goal_hours")
        .eq("id", user.id)
        .single();

      // Helpers/managers have no IRS target test; their goal defaults to 100.
      const { data: membership } = await supabase
        .from("team_members")
        .select("role")
        .eq("member_id", user.id)
        .eq("status", "active")
        .neq("owner_id", user.id)
        .limit(1)
        .maybeSingle();
      const staff = membership?.role === "employee" || membership?.role === "manager";
      setIsStaff(staff);

      if (data) {
        const savedYear = String(data.tax_year);
        setTaxYear(savedYear);
        setTargetTest(data.target_test);
        setGoalHours(String(staff && data.goal_hours === 500 ? 100 : data.goal_hours));
        setYears((prev) =>
          prev.includes(savedYear) ? prev : [...prev, savedYear].sort().reverse()
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const hours = parseInt(goalHours, 10);
    if (!hours || hours < 1) {
      setError("Please enter a valid goal (at least 1 hour).");
      setSaving(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("You must be logged in.");
      setSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        tax_year: parseInt(taxYear, 10),
        target_test: targetTest,
        goal_hours: hours,
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push("/settings");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
        onSubmit={handleSubmit}
      >
        {error && (
          <div className="px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
            <p className="text-[13px] text-tangerine">{error}</p>
          </div>
        )}

        {/* Tax year */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3 block">
            Tax year <span className="text-tangerine">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setTaxYear(y)}
                className={`min-h-11 px-5 py-2.5 rounded-md text-[15px] font-medium transition-colors ${
                  taxYear === y
                    ? "border border-plum bg-plum-mist text-char"
                    : "border border-chalk bg-cream text-quill hover:border-plum"
                }`}
              >
                {y}
              </button>
            ))}
            {!addingYear && (
              <button
                type="button"
                onClick={() => setAddingYear(true)}
                className="min-h-11 px-4 py-2.5 border border-dashed border-stone rounded-md text-[15px] font-medium text-stone hover:border-plum hover:text-plum transition-colors"
              >
                + Add year
              </button>
            )}
          </div>
          {addingYear && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const y = newYear.trim();
                    if (y.length === 4 && !years.includes(y)) {
                      setYears((prev) => [...prev, y].sort().reverse());
                      setTaxYear(y);
                    }
                    setNewYear("");
                    setAddingYear(false);
                  }
                  if (e.key === "Escape") { setAddingYear(false); setNewYear(""); }
                }}
                autoFocus
                placeholder="e.g. 2027"
                className="w-28 min-h-11 px-3.5 py-2 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone tabular-nums"
              />
              <button
                type="button"
                onClick={() => {
                  const y = newYear.trim();
                  if (y.length === 4 && !years.includes(y)) {
                    setYears((prev) => [...prev, y].sort().reverse());
                    setTaxYear(y);
                  }
                  setNewYear("");
                  setAddingYear(false);
                }}
                className="min-h-11 px-4 py-2 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setAddingYear(false); setNewYear(""); }}
                className="min-h-11 px-3 py-2 rounded-md text-[13px] text-quill hover:text-char transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Target test — owners/spouses only; not relevant to helpers/managers */}
        {!isStaff && (
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
        )}

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
            disabled={saving}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
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
