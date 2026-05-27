"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { Dock } from "@/components/dock";
import { createClient } from "@/lib/supabase/client";

type Property = { id: string; name: string };

type TimeLog = {
  id: string;
  title: string;
  category: string;
  started_at: string;
  duration_secs: number;
  description: string | null;
  property: { name: string } | null;
};

const CATEGORY_COLORS = [
  "bg-plum",
  "bg-tangerine",
  "bg-[#0F6E56]",
  "bg-[#1565C0]",
  "bg-[#AD1457]",
  "bg-char",
  "bg-slate",
  "bg-stone",
];

export default function ReportsPage() {
  return (
    <Suspense>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "activity" ? "activity" : "reports";

  const [properties, setProperties] = useState<Property[]>([]);
  const [allActivity, setAllActivity] = useState<TimeLog[]>([]);
  const [totalHours, setTotalHours] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeProp, setActiveProp] = useState("All properties");

  const goalHours = 500;

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [{ data: props }, { data: logs }] = await Promise.all([
        supabase
          .from("properties")
          .select("id, name")
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("time_logs")
          .select("id, title, category, started_at, duration_secs, description, property:properties(name)")
          .is("deleted_at", null)
          .order("started_at", { ascending: false }),
      ]);

      setProperties(props ?? []);
      const entries = (logs as TimeLog[] | null) ?? [];
      setAllActivity(entries);

      const total = entries.reduce((sum, e) => sum + (e.duration_secs ?? 0), 0);
      setTotalHours(total / 3600);
      setLoading(false);
    }
    load();
  }, []);

  const propertyFilters = properties.length > 1
    ? ["All properties", ...properties.map((p) => p.name)]
    : [];

  const filteredActivity = activeProp === "All properties"
    ? allActivity
    : allActivity.filter((e) => e.property?.name === activeProp);

  const filteredHours = filteredActivity.reduce((sum, e) => sum + (e.duration_secs ?? 0), 0) / 3600;

  // Category breakdown
  const catMap = new Map<string, number>();
  for (const entry of filteredActivity) {
    const name = entry.title || entry.category;
    catMap.set(name, (catMap.get(name) ?? 0) + (entry.duration_secs ?? 0) / 3600);
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([name, hours]) => ({ name, hours, pct: filteredHours > 0 ? (hours / filteredHours) * 100 : 0 }))
    .sort((a, b) => b.hours - a.hours);

  // IRS tests
  const goalPct = goalHours > 0 ? Math.min((filteredHours / goalHours) * 100, 100) : 0;
  const hoursRemaining = Math.max(goalHours - filteredHours, 0);

  const irsTests = [
    {
      name: "500-Hour Test",
      status: filteredHours >= 500 ? "Passed" : "In progress",
      statusColor: filteredHours >= 500 ? "bg-success-bg text-success" : "bg-tangerine/10 text-tangerine",
      detail: `${filteredHours.toFixed(1)} of 500 hours logged`,
      barPct: Math.min((filteredHours / 500) * 100, 100),
      barColor: filteredHours >= 500 ? "bg-success" : "bg-plum",
      coach: filteredHours >= 500
        ? "You've met the 500-hour material participation threshold."
        : `${hoursRemaining.toFixed(0)} more hours needed to meet this test.`,
      coachColor: filteredHours >= 500 ? "text-success" : "text-slate",
    },
    {
      name: "100-Hour Test",
      status: filteredHours >= 100 ? "Passed" : "In progress",
      statusColor: filteredHours >= 100 ? "bg-success-bg text-success" : "bg-tangerine/10 text-tangerine",
      detail: `${filteredHours.toFixed(1)} of 100 hours logged`,
      barPct: Math.min((filteredHours / 100) * 100, 100),
      barColor: filteredHours >= 100 ? "bg-success" : "bg-plum",
      coach: filteredHours >= 100
        ? "You've logged 100+ hours. This test also requires that no one else participates more."
        : `${Math.max(100 - filteredHours, 0).toFixed(0)} more hours needed.`,
      coachColor: filteredHours >= 100 ? "text-success" : "text-slate",
    },
  ];

  function formatDayLabel(dateStr: string) {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - entryDate.getTime()) / 86400000);
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }

  function escapeCsvField(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function emailReportCsv() {
    setEmailing(true);
    setEmailSent(false);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      setEmailing(false);
      return;
    }

    const headers = ["Date", "Start Time", "Hours", "Category", "Property", "Notes"];
    const rows = filteredActivity.map((entry) => {
      const d = new Date(entry.started_at);
      const date = d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
      const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const hours = (entry.duration_secs / 3600).toFixed(2);
      const category = entry.title || "";
      const property = entry.property?.name || "";
      const notes = entry.description || "";
      return [date, time, hours, category, property, notes].map(escapeCsvField).join(",");
    });

    const totalRow = ["", "", filteredHours.toFixed(2), "TOTAL", "", ""].join(",");
    const csv = [headers.join(","), ...rows, "", totalRow].join("\n");

    const res = await fetch("/api/email-report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, email: user.email, property: activeProp }),
    });

    setEmailing(false);
    if (res.ok) setEmailSent(true);
  }

  const hasReportData = allActivity.length > 0;
  const hasActivity = filteredActivity.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
        <Dock />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <TopStrip backHref="/dashboard" label="Reports" />

      <div className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="px-7 py-5 border-b border-chalk">
          <h1 className="font-serif text-[28px] text-plum">
            {activeTab === "reports" ? "Reports" : "Activities"}
          </h1>
        </div>

        {/* Tabs */}
        <div className="px-7 flex border-b border-chalk">
          <Link
            href="/reports"
            className={`py-3 mr-6 font-mono text-[11px] uppercase tracking-[1.5px] font-medium transition-colors border-b-2 ${
              activeTab === "reports"
                ? "text-plum border-plum"
                : "text-quill border-transparent hover:text-plum"
            }`}
          >
            Reports
          </Link>
          <Link
            href="/reports?tab=activity"
            className={`py-3 font-mono text-[11px] uppercase tracking-[1.5px] font-medium transition-colors border-b-2 ${
              activeTab === "activity"
                ? "text-plum border-plum"
                : "text-quill border-transparent hover:text-plum"
            }`}
          >
            Activities
          </Link>
        </div>

        {/* ── Activity tab ────────────────────────────────────── */}
        {activeTab === "activity" && (
          <>
            {allActivity.length > 0 ? (
              <>
                {/* Property filter */}
                {propertyFilters.length > 0 && (
                  <div className="px-7 py-4 flex gap-1.5 overflow-x-auto border-b border-chalk scrollbar-thin">
                    {propertyFilters.map((f) => {
                      const active = activeProp === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setActiveProp(f)}
                          className={`shrink-0 min-h-9 px-3.5 py-2 rounded-[999px] text-[13px] font-medium transition-colors ${
                            active
                              ? "bg-char text-cream border border-char"
                              : "border border-chalk text-quill hover:border-stone"
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Summary */}
                <div className="px-7 py-5 border-b border-chalk flex items-center justify-between">
                  <span className="font-sans text-[13px] text-slate">
                    {filteredActivity.length} entries &middot;{" "}
                    {filteredHours.toFixed(1)} hours
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-quill">
                    Most recent first
                  </span>
                </div>

                {/* List */}
                {filteredActivity.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/activity/${entry.id}/edit`}
                    className="px-7 py-[18px] border-b border-chalk hover:bg-vellum transition-colors block"
                  >
                    <div
                      className="grid items-center gap-3"
                      style={{ gridTemplateColumns: "56px 1fr auto" }}
                    >
                      <div className="flex flex-col">
                        <span className="font-mono text-[12px] font-bold text-char leading-tight">
                          {formatDayLabel(entry.started_at)}
                        </span>
                        <span className="font-mono text-[11px] text-slate leading-tight">
                          {formatTime(entry.started_at)}
                        </span>
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="font-serif text-[15px] font-medium leading-snug truncate">
                          {entry.title}
                        </span>
                        <span className="font-sans text-[12px] text-quill truncate">
                          {entry.property?.name ?? "—"}
                        </span>
                      </div>
                      <span className="font-serif text-[17px] text-plum tabular-nums">
                        {(entry.duration_secs / 3600).toFixed(1)}h
                      </span>
                    </div>
                    {entry.description && (
                      <p className="mt-2 ml-[68px] font-sans text-[12px] text-slate leading-relaxed line-clamp-2">
                        {entry.description}
                      </p>
                    )}
                  </Link>
                ))}
              </>
            ) : (
              <div className="px-7 py-16 text-center">
                <p className="font-serif text-[22px] text-plum mb-2">
                  No activity yet
                </p>
                <p className="font-sans text-[13px] text-quill leading-relaxed mb-8 max-w-[280px] mx-auto">
                  Start a timer or log hours manually. Your entries will appear here.
                </p>
                <div className="flex flex-col gap-3 max-w-[240px] mx-auto">
                  <Link
                    href="/timer"
                    className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center"
                  >
                    Start timer
                  </Link>
                  <Link
                    href="/log"
                    className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-cream text-quill border border-chalk hover:border-stone transition-colors text-center"
                  >
                    Log hours manually
                  </Link>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── Reports tab ─────────────────────────────────────── */}
        {activeTab === "reports" && (
          <>
            {hasReportData ? (
              <>
                {/* Property filter */}
                {propertyFilters.length > 0 && (
                  <div className="px-7 py-4 flex gap-1.5 overflow-x-auto border-b border-chalk scrollbar-thin">
                    {propertyFilters.map((f) => {
                      const active = activeProp === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setActiveProp(f)}
                          className={`shrink-0 min-h-9 px-3.5 py-2 rounded-[999px] text-[13px] font-medium transition-colors ${
                            active
                              ? "bg-char text-cream border border-char"
                              : "border border-chalk text-quill hover:border-stone"
                          }`}
                        >
                          {f}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Hero stat */}
                <section className="px-7 py-8 border-b border-chalk">
                  <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-slate font-medium">
                    Total &middot; 2026
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="font-serif text-[88px] text-plum tabular-nums tracking-[-5px] leading-none">
                      {filteredHours.toFixed(1)}
                    </span>
                    <span className="font-serif text-[26px] italic text-quill">hours</span>
                  </div>
                </section>

                {/* IRS tests */}
                {irsTests.map((test) => (
                  <div key={test.name} className="px-7 py-5 border-b border-chalk">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-serif text-[18px] font-medium text-char">
                        {test.name}
                      </span>
                      <span
                        className={`px-2.5 py-1 rounded-[999px] font-mono text-[10px] uppercase tracking-[1px] font-medium ${test.statusColor}`}
                      >
                        {test.status}
                      </span>
                    </div>
                    <p className="font-sans text-[13px] text-slate mb-3">{test.detail}</p>
                    <div className="h-[3px] rounded-full bg-bone mb-3">
                      <div
                        className={`h-full rounded-full ${test.barColor}`}
                        style={{ width: `${Math.min(test.barPct, 100)}%` }}
                      />
                    </div>
                    <p className={`font-sans text-[12px] leading-relaxed ${test.coachColor}`}>
                      {test.coach}
                    </p>
                  </div>
                ))}

                {/* By category */}
                {categoryBreakdown.length > 0 && (
                  <>
                    <div className="px-7 py-4 border-b border-chalk">
                      <h2 className="font-serif text-[22px] text-char">By category</h2>
                    </div>
                    {categoryBreakdown.map((cat, i) => (
                      <div
                        key={cat.name}
                        className="px-7 py-4 border-b border-chalk grid items-center gap-3"
                        style={{ gridTemplateColumns: "1fr auto" }}
                      >
                        <div className="flex flex-col gap-2">
                          <span className="font-serif text-[15px] font-medium text-char">
                            {cat.name}
                          </span>
                          <div className="h-[2px] rounded-full bg-bone">
                            <div
                              className={`h-full rounded-full ${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}`}
                              style={{ width: `${cat.pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-baseline gap-0.5">
                          <span className="font-serif text-[18px] text-plum tabular-nums">
                            {cat.hours.toFixed(1)}
                          </span>
                          <span className="font-serif text-[13px] italic text-quill">h</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Export */}
                <div className="px-7 py-7">
                  <button
                    type="button"
                    onClick={emailReportCsv}
                    disabled={emailing}
                    className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {emailing ? "Sending…" : "Email Report CSV"}
                  </button>
                  {emailSent && (
                    <p className="font-sans text-[12px] text-success text-center mt-3">
                      Report sent to your email.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="px-7 py-16 text-center">
                <p className="font-serif text-[22px] text-plum mb-2">
                  No data yet
                </p>
                <p className="font-sans text-[13px] text-quill leading-relaxed mb-8 max-w-[280px] mx-auto">
                  Once you start logging hours, your IRS material participation
                  tests and category breakdown will appear here.
                </p>
                <div className="flex flex-col gap-3 max-w-[240px] mx-auto">
                  <Link
                    href="/timer"
                    className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center"
                  >
                    Start tracking
                  </Link>
                  <Link
                    href="/settings/tax"
                    className="inline-block min-h-12 px-6 py-3.5 rounded-md text-[15px] font-medium bg-cream text-quill border border-chalk hover:border-stone transition-colors text-center"
                  >
                    Set your tax goal
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dock />
    </div>
  );
}
