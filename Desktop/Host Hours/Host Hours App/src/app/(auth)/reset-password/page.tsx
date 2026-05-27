"use client";

import Link from "next/link";
import { TopStrip } from "@/components/top-strip";

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh bg-cream flex flex-col">
      <TopStrip backHref="/login" />

      <div className="mx-auto max-w-sm w-full px-7 pt-4 pb-10 flex-1 flex flex-col">
        {/* ── Eyebrow ── */}
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-tangerine mb-3">
          Reset password
        </span>

        {/* ── Headline ── */}
        <h1 className="font-serif text-[38px] font-normal leading-[1.05] tracking-[-1.5px] text-plum mb-2">
          Forgot it? It&nbsp;happens.
        </h1>

        {/* ── Deck ── */}
        <p className="font-serif italic text-[15px] text-quill leading-relaxed mb-8">
          Drop your email below and we&rsquo;ll send a reset link.
        </p>

        {/* ── Decorative glyph ── */}
        <div className="flex justify-center mb-8">
          <span className="font-serif text-[96px] leading-none text-plum select-none">
            <span className="font-serif italic text-tangerine">?</span>
          </span>
        </div>

        {/* ── Form ── */}
        <form
          onSubmit={(e) => e.preventDefault()}
          className="flex flex-col gap-5"
        >
          {/* Email */}
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

          {/* Submit */}
          <button
            type="submit"
            className="w-full flex items-center justify-center bg-plum text-cream hover:bg-plum-deep min-h-12 px-5.5 py-3.5 rounded-md font-medium text-[15px] transition-colors mt-1"
          >
            Send reset link
          </button>
        </form>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Footer ── */}
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
