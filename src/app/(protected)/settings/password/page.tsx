"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings" label="Password" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Security
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Change password.
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
        {success && (
          <div className="px-4 py-3 rounded-md bg-success-bg border border-success/30">
            <p className="text-[13px] text-success">Password updated.</p>
          </div>
        )}

        {/* New password */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            New password <span className="text-tangerine">*</span>
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist"
            placeholder="At least 8 characters"
          />
        </div>

        {/* Confirm new password */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Confirm new password <span className="text-tangerine">*</span>
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist"
            placeholder="Re-enter new password"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? "Updating…" : "Update password"}
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
