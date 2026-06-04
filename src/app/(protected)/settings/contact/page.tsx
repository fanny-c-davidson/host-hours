"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";

const SUPPORT_EMAIL = "relaxrechargerentals@gmail.com";

const subjects: { value: string; label: string }[] = [
  { value: "Billing & subscription", label: "Billing & subscription" },
  { value: "Report a bug", label: "Report a bug" },
  { value: "Feature request", label: "Feature request" },
  { value: "Tax & IRS questions", label: "Tax & IRS questions" },
  { value: "Other", label: "Other" },
];

export default function ContactPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject || "Host Hours support")}&body=${encodeURIComponent(message)}`;

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

      <div className="px-7 py-6 flex flex-col gap-6">
        {/* Subject */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Subject
          </label>
          <div className="relative">
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist appearance-none pr-10"
            >
              <option value="">Select a topic</option>
              {subjects.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
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
            Message
          </label>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us how we can help..."
            className="w-full min-h-24 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist resize-vertical font-sans leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <a
            href={mailtoHref}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all flex items-center justify-center"
          >
            Send
          </a>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full min-h-12 bg-cream text-quill border border-chalk font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:border-stone active:scale-[0.98] transition-all"
          >
            Cancel
          </button>
        </div>

        <p className="text-[12px] text-slate text-center">
          You can also email us directly at{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-plum underline decoration-tangerine underline-offset-[3px] decoration-[1.5px]">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}
