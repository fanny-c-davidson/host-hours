"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "true";

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(
    expired ? "That reset link has expired. Please request a new one." : null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter your email.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings/password`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="min-h-dvh bg-cream flex flex-col">
        <TopStrip backHref="/login" />
        <div className="mx-auto max-w-sm w-full px-7 pt-4 pb-10 flex-1 flex flex-col justify-center">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3">
            Check your email
          </span>
          <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-4">
            Link sent.
          </h1>
          <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-6">
            We sent a reset link to{" "}
            <strong className="text-char not-italic">{email}</strong>.
            Click it to set a new password.
          </p>
          <p className="text-[13px] text-slate leading-relaxed">
            Didn&rsquo;t get it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-plum underline decoration-tangerine underline-offset-[3px] decoration-[1.5px] min-h-[44px] inline-flex items-center"
            >
              try again
            </button>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      <TopStrip backHref="/login" />

      <div className="mx-auto max-w-sm w-full px-7 pt-4 pb-10 flex-1 flex flex-col">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3">
          Reset password
        </span>

        <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-2">
          Forgot it? It&nbsp;happens.
        </h1>

        <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-8">
          Drop your email below and we&rsquo;ll send a reset link.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
            <p className="text-[13px] text-tangerine">{error}</p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5"
        >
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors mt-1 disabled:opacity-50"
          >
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <div className="flex-1" />

        <p className="text-center text-[13px] text-quill pt-8 pb-2">
          Remembered it?{" "}
          <Link
            href="/login"
            className="text-plum font-medium underline decoration-tangerine underline-offset-[3px] decoration-[1.5px]"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
