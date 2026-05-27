"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";

const COLORS = [
  { name: "Plum", value: "#4A148C" },
  { name: "Tangerine", value: "#FF6B35" },
  { name: "Teal", value: "#0F6E56" },
  { name: "Slate", value: "#5F5E5A" },
  { name: "Ocean", value: "#1565C0" },
  { name: "Rose", value: "#AD1457" },
];

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("properties")
        .select("name, address, description, color")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setName(data.name);
      setAddress(data.address || "");
      setDescription(data.description || "");
      setSelectedColor(data.color || COLORS[0].value);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Property name is required.");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const { error: updateError } = await supabase
      .from("properties")
      .update({
        name: trimmedName,
        address: address.trim() || null,
        description: description.trim() || null,
        color: selectedColor,
      })
      .eq("id", id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    router.push("/properties");
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    const supabase = createClient();

    await supabase
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    router.push("/properties");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <TopStrip backHref="/properties" label="Edit property" />
        <div className="flex-1 flex items-center justify-center px-7">
          <p className="font-serif text-[18px] text-quill">Property not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <TopStrip backHref="/properties" label="Edit property" />

      <div className="px-7 pt-6 pb-6 border-b border-chalk">
        <span className="font-mono text-[10px] tracking-[2px] uppercase text-tangerine font-medium">
          Edit property
        </span>
        <h1 className="font-serif text-[36px] font-normal text-plum tracking-[-1.2px] leading-none mt-2">
          Update listing.
        </h1>
      </div>

      <form onSubmit={handleSave} className="px-7 py-6 flex-1 flex flex-col">
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
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone"
            placeholder="123 Ocean Drive, Miami, FL"
          />
        </div>

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
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

        <div className="flex flex-col gap-3">
          <button
            type="submit"
            disabled={saving}
            className="w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors text-center disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full min-h-12 px-5.5 py-3.5 rounded-md text-[15px] font-medium bg-cream text-quill border border-chalk hover:border-stone transition-colors text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="w-full min-h-12 px-5.5 py-3.5 rounded-md font-mono text-[11px] uppercase tracking-[1.5px] font-medium bg-cream text-tangerine border border-chalk hover:border-tangerine active:scale-[0.98] transition-all disabled:opacity-50 text-center"
          >
            {deleting ? "Deleting…" : confirmDelete ? "Tap again to confirm delete" : "Delete property"}
          </button>
        </div>
      </form>
    </div>
  );
}
