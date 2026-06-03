"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

const targetTests = [
  { id: "500", label: "500 hours", description: "Most common. You must log 500+ hours of material participation." },
  { id: "100", label: "100 hours", description: "You participate 100+ hours and no one else participates more." },
  { id: "substantially", label: "Substantially all", description: "You perform 90%+ of all work on the activity." },
];

type SpouseLink = {
  id: string;
  requester_id: string;
  partner_email: string;
  partner_id: string | null;
  status: "pending" | "active";
};

export default function TaxSettingsPage() {
  const router = useRouter();
  const [taxYear, setTaxYear] = useState("2026");
  const [targetTest, setTargetTest] = useState("500");
  const [goalHours, setGoalHours] = useState("500");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [years, setYears] = useState<string[]>(["2026"]);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [spouseLink, setSpouseLink] = useState<SpouseLink | null>(null);
  const [spouseName, setSpouseName] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [spouseError, setSpouseError] = useState<string | null>(null);
  const [spouseSaving, setSpouseSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setUserId(user.id);
      setUserEmail(user.email ?? "");

      const { data } = await supabase
        .from("profiles")
        .select("tax_year, target_test, goal_hours")
        .eq("id", user.id)
        .single();

      if (data) {
        const savedYear = String(data.tax_year);
        setTaxYear(savedYear);
        setTargetTest(data.target_test);
        setGoalHours(String(data.goal_hours));
        setYears((prev) =>
          prev.includes(savedYear) ? prev : [...prev, savedYear].sort().reverse()
        );
      }

      await loadSpouseLink(user.id, user.email ?? "");
      setLoading(false);
    }
    load();
  }, []);

  async function loadSpouseLink(uid: string, email: string) {
    const supabase = createClient();

    const { data: sent } = await supabase
      .from("spouse_links")
      .select("id, requester_id, partner_email, partner_id, status")
      .eq("requester_id", uid)
      .limit(1)
      .single();

    if (sent) {
      setSpouseLink(sent);
      if (sent.partner_id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", sent.partner_id)
          .single();
        setSpouseName(profile?.full_name ?? sent.partner_email);
      }
      return;
    }

    const { data: received } = await supabase
      .from("spouse_links")
      .select("id, requester_id, partner_email, partner_id, status")
      .eq("partner_email", email)
      .limit(1)
      .single();

    if (received) {
      setSpouseLink(received);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", received.requester_id)
        .single();
      setSpouseName(profile?.full_name ?? null);
      return;
    }

    setSpouseLink(null);
    setSpouseName(null);
  }

  async function sendInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !userId) return;
    if (email === userEmail.toLowerCase()) {
      setSpouseError("You can't link to your own account.");
      return;
    }

    setSpouseSaving(true);
    setSpouseError(null);
    const supabase = createClient();

    const { error: insertErr } = await supabase
      .from("spouse_links")
      .insert({ requester_id: userId, partner_email: email });

    if (insertErr) {
      setSpouseError(insertErr.message.includes("unique")
        ? "You already have a pending or active link."
        : insertErr.message);
      setSpouseSaving(false);
      return;
    }

    setInviteEmail("");
    await loadSpouseLink(userId, userEmail);
    setSpouseSaving(false);
  }

  async function acceptInvite() {
    if (!spouseLink || !userId) return;
    setSpouseSaving(true);
    const supabase = createClient();

    await supabase
      .from("spouse_links")
      .update({ partner_id: userId, status: "active" })
      .eq("id", spouseLink.id);

    await loadSpouseLink(userId, userEmail);
    setSpouseSaving(false);
  }

  async function unlinkSpouse() {
    if (!spouseLink) return;
    setSpouseSaving(true);
    const supabase = createClient();

    await supabase
      .from("spouse_links")
      .delete()
      .eq("id", spouseLink.id);

    setSpouseLink(null);
    setSpouseName(null);
    setSpouseSaving(false);
  }

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

  const isRequester = spouseLink?.requester_id === userId;
  const isPendingForMe = spouseLink?.status === "pending" && !isRequester;

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

      {/* ── Spouse / partner linking ────────────────────────────── */}
      <div className="px-7 pt-2 pb-6">
        <div className="border-t border-chalk pt-6">
          <span className="font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium">
            Spouse account
          </span>
          <h2 className="font-serif text-[22px] text-plum mt-1 mb-1">
            Link a spouse.
          </h2>
          <p className="font-sans text-[13px] text-slate leading-relaxed mb-5">
            The IRS allows spouses to combine hours for material participation tests.
            Link your accounts to see combined totals on Reports.
          </p>

          {spouseError && (
            <div className="mb-4 px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
              <p className="text-[13px] text-tangerine">{spouseError}</p>
            </div>
          )}

          {/* No link yet */}
          {!spouseLink && (
            <div className="flex items-center gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); sendInvite(); }
                }}
                placeholder="Spouse's email address"
                className="flex-1 min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
              />
              <button
                type="button"
                onClick={sendInvite}
                disabled={spouseSaving || !inviteEmail.trim()}
                className="min-h-12 px-5 py-3.5 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors disabled:opacity-50"
              >
                {spouseSaving ? "Sending…" : "Link"}
              </button>
            </div>
          )}

          {/* Pending — I sent it */}
          {spouseLink?.status === "pending" && isRequester && (
            <div className="p-4 rounded-md border border-chalk bg-vellum">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-tangerine animate-pulse-dot" />
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
                  Pending
                </span>
              </div>
              <p className="font-serif text-[15px] text-char mb-1">
                Invitation sent to <strong>{spouseLink.partner_email}</strong>
              </p>
              <p className="font-sans text-[12px] text-slate mb-4">
                They need to log in and accept the link from their Tax settings.
              </p>
              <button
                type="button"
                onClick={unlinkSpouse}
                disabled={spouseSaving}
                className="min-h-11 px-4 py-2 rounded-md font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine border border-chalk hover:border-tangerine transition-colors disabled:opacity-50"
              >
                Cancel invite
              </button>
            </div>
          )}

          {/* Pending — sent to me */}
          {isPendingForMe && (
            <div className="p-4 rounded-md border border-plum bg-plum-mist">
              <p className="font-serif text-[15px] text-char mb-1">
                <strong>{spouseName ?? "Your spouse"}</strong> wants to link accounts
              </p>
              <p className="font-sans text-[12px] text-slate mb-4">
                Accept to combine hours on your Reports page.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={acceptInvite}
                  disabled={spouseSaving}
                  className="min-h-11 px-5 py-2 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={unlinkSpouse}
                  disabled={spouseSaving}
                  className="min-h-11 px-4 py-2 rounded-md text-[13px] text-quill border border-chalk hover:border-stone transition-colors disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </div>
          )}

          {/* Active link */}
          {spouseLink?.status === "active" && (
            <div className="p-4 rounded-md border border-chalk bg-vellum">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-success" />
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-success font-medium">
                  Linked
                </span>
              </div>
              <p className="font-serif text-[15px] text-char mb-1">
                Linked with <strong>{spouseName ?? (isRequester ? spouseLink.partner_email : "your spouse")}</strong>
              </p>
              <p className="font-sans text-[12px] text-slate mb-4">
                Combined hours are available on the Reports page.
              </p>
              <button
                type="button"
                onClick={unlinkSpouse}
                disabled={spouseSaving}
                className="min-h-11 px-4 py-2 rounded-md font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine border border-chalk hover:border-tangerine transition-colors disabled:opacity-50"
              >
                Unlink
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
