"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const COLORS = [
  { name: "Plum", value: "#4A148C" },
  { name: "Tangerine", value: "#FF6B35" },
  { name: "Teal", value: "#0F6E56" },
  { name: "Slate", value: "#5F5E5A" },
  { name: "Ocean", value: "#1565C0" },
  { name: "Rose", value: "#AD1457" },
];

export default function NewPropertyPage() {
  const router = useRouter();
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const address = (form.get("address") as string).trim();
    const description = (form.get("description") as string).trim();

    if (!name) {
      setError("Property name is required.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be logged in.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("properties").insert({
      user_id: user.id,
      name,
      address: address || null,
      description: description || null,
      color: selectedColor,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    router.push("/properties");
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="flex items-center justify-between px-7 pt-5 pb-1 shrink-0">
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[1px] uppercase text-quill hover:text-plum py-2 px-0.5"
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="7.5 9 4.5 6 7.5 3" />
          </svg>
          Back
        </Link>
        <span className="font-mono text-[10px] tracking-[1.5px] uppercase text-slate">
          New property
        </span>
      </div>

      <div className="px-7 pt-6 pb-6 border-b border-chalk">
        <span className="font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium">
          Add property
        </span>
        <h1 className="font-serif text-[36px] font-normal text-plum tracking-[-1.2px] leading-none mt-2">
          New listing.
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="px-7 py-6 flex-1 flex flex-col">
        {error && (
          <div className="mb-5 px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
            <p className="text-[13px] text-tangerine">{error}</p>
          </div>
        )}

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2">
            Property name <span className="text-tangerine">*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone"
            placeholder="e.g. Beach House"
          />
        </div>

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2">
            Address
          </label>
          <input
            type="text"
            name="address"
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone"
            placeholder="123 Ocean Drive, Miami, FL"
          />
        </div>

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2">
            Description
          </label>
          <textarea
            name="description"
            className="w-full min-h-24 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone resize-vertical font-sans leading-relaxed"
            placeholder="A short description of the property..."
          />
        </div>

        <div className="mb-8">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3">
            Color
          </label>
          <div className="flex gap-3">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setSelectedColor(c.value)}
                className={`w-10 h-10 rounded-full transition-all ${
                  selectedColor === c.value
                    ? "ring-2 ring-offset-2 ring-offset-cream ring-plum scale-110"
                    : "hover:scale-105"
                }`}
                style={{ background: c.value }}
                title={c.name}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center disabled:opacity-50"
        >
          {loading ? "Saving…" : "Add property"}
        </button>
      </form>
    </div>
  );
}
