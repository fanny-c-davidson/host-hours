"use client";

import Link from "next/link";
import { TopStrip } from "@/components/top-strip";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");

  async function handleGoogleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!agreed) {
      setError("Please agree to the Terms and Privacy Policy.");
      return;
    }

    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSignupEmail(email);
    setConfirmationSent(true);
    setLoading(false);
  }

  if (confirmationSent) {
    return (
      <div className="min-h-dvh bg-cream flex flex-col">
        <TopStrip backHref="/" />
        <div className="mx-auto max-w-sm w-full px-7 pt-4 pb-10 flex-1 flex flex-col justify-center">
          <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3">
            Check your email
          </span>
          <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-4">
            Almost there.
          </h1>
          <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-6">
            We sent a confirmation link to{" "}
            <strong className="text-char not-italic">{signupEmail}</strong>.
            Click it to activate your account.
          </p>
          <p className="text-[13px] text-slate leading-relaxed">
            Didn&rsquo;t get it? Check your spam folder, or{" "}
            <button
              type="button"
              onClick={() => setConfirmationSent(false)}
              className="text-plum underline decoration-tangerine underline-offset-[3px] decoration-[1.5px]"
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
      <TopStrip backHref="/" />

      <div className="mx-auto max-w-sm w-full px-7 pt-4 pb-10 flex-1 flex flex-col">
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3">
          Create account
        </span>

        <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-2">
          One minute. No&nbsp;card.
        </h1>

        <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-8">
          Track your first ten hours free &mdash; no credit card, no&nbsp;commitment.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
            <p className="text-[13px] text-tangerine">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Full name
            </label>
            <input
              type="text"
              name="name"
              required
              placeholder="Jane Doe"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone transition-colors"
            />
          </div>

          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              placeholder="••••••••"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone transition-colors"
            />
            <p className="text-xs text-slate mt-1.5">
              At least eight characters. A passphrase is fine.
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-chalk text-plum focus:ring-plum-mist accent-plum"
            />
            <span className="text-[13px] text-quill leading-snug">
              I agree to the{" "}
              <Link
                href="#"
                className="text-plum font-medium underline decoration-tangerine underline-offset-[3px] decoration-[1.5px]"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="#"
                className="text-plum font-medium underline decoration-tangerine underline-offset-[3px] decoration-[1.5px]"
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors mt-1 disabled:opacity-50"
          >
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="flex items-center gap-4 my-7">
          <span className="flex-1 h-px bg-chalk" />
          <span className="text-[12px] text-slate">or</span>
          <span className="flex-1 h-px bg-chalk" />
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-3 bg-transparent text-plum border border-chalk hover:border-plum min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        <div className="flex-1" />

        <p className="text-center text-[13px] text-quill pt-8 pb-2">
          Already a member?{" "}
          <Link
            href="/login"
            className="text-plum font-medium underline decoration-tangerine underline-offset-[3px] decoration-[1.5px]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
