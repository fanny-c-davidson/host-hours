"use client";

import { useRouter } from "next/navigation";
import { TopStrip } from "@/components/top-strip";

export default function UpdatePaymentPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings/billing" label="Payment" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Payment
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          Update card.
        </h1>
      </header>

      <form
        className="px-7 py-6 flex flex-col gap-6"
        onSubmit={(e) => e.preventDefault()}
      >
        {/* Card number */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Card number <span className="text-tangerine">*</span>
          </label>
          <input
            type="text"
            required
            inputMode="numeric"
            placeholder="1234 5678 9012 3456"
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist tabular-nums"
          />
        </div>

        {/* Expiry + CVC */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Expiry <span className="text-tangerine">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="MM / YY"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist tabular-nums"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              CVC <span className="text-tangerine">*</span>
            </label>
            <input
              type="text"
              required
              inputMode="numeric"
              placeholder="123"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist tabular-nums"
            />
          </div>
        </div>

        {/* Name on card */}
        <div>
          <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
            Name on card <span className="text-tangerine">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="Full name on card"
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:shadow-[0_0_0_4px] focus:shadow-plum-mist"
          />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-2">
          <button
            type="submit"
            onClick={() => router.push("/settings/billing")}
            className="w-full min-h-12 bg-plum text-cream font-mono text-[11px] uppercase tracking-[1.5px] font-medium rounded-md hover:bg-plum-deep active:scale-[0.98] transition-all"
          >
            Update card
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
