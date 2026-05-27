"use client";

import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";

export default function ContactPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings" label="Contact us" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Support
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Contact us.
        </h1>
      </header>

      <form
        className="px-7 py-6 flex flex-col gap-6"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Subject */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Subject <span className="text-tangerine">*</span>
          </label>
          <div className="relative">
            <select
              required
              defaultValue=""
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist appearance-none pr-10"
            >
              <option value="" disabled>
                Select a topic
              </option>
              <option value="billing">Billing &amp; subscription</option>
              <option value="bug">Report a bug</option>
              <option value="feature">Feature request</option>
              <option value="tax">Tax &amp; IRS questions</option>
              <option value="other">Other</option>
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

        {/* Message */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Message <span className="text-tangerine">*</span>
          </label>
          <textarea
            required
            rows={5}
            placeholder="Tell us how we can help..."
            className="w-full min-h-24 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist resize-vertical font-sans leading-relaxed"
          />
        </div>

        {/* Attachment */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Attachment
          </label>
          <div className="border border-dashed border-stone rounded-md p-7 text-center bg-cream">
            <p className="font-serif text-[15px] font-medium text-char">
              Drop a screenshot or file
            </p>
            <p className="mt-1 font-sans text-[12px] text-slate">
              Optional. Helps us understand the issue faster.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <button
            type="submit"
            onClick={() => router.push("/settings")}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all"
          >
            Send message
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
