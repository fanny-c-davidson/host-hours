"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TopStrip } from "@/components/top-strip";
import { AddressInput } from "@/components/address-input";
import { TagInput } from "@/components/tag-input";
import { createClient } from "@/lib/supabase/client";

const PRESET_COLORS = [
  "#4A148C", "#FF6B35", "#0F6E56", "#5F5E5A",
  "#1565C0", "#AD1457", "#F9A825", "#00695C",
];

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [customColor, setCustomColor] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const activeColor = customColor || selectedColor;

  // Only owners and spouses may edit properties — bounce others out.
  useEffect(() => {
    async function guard() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("team_members")
        .select("role")
        .eq("member_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (membership && membership.role !== "spouse") router.replace("/properties");
    }
    guard();
  }, [router]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data }, { data: allProps }] = await Promise.all([
        supabase
          .from("properties")
          .select("name, address, color, tags, latitude, longitude")
          .eq("id", id)
          .is("deleted_at", null)
          .single(),
        supabase
          .from("properties")
          .select("tags")
          .is("deleted_at", null),
      ]);

      const tagSet = new Set<string>();
      (allProps ?? []).forEach((p) => (p.tags ?? []).forEach((t: string) => tagSet.add(t)));
      setAllTags(Array.from(tagSet).sort());

      if (!data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setName(data.name);
      setAddress(data.address || "");
      setLatitude(data.latitude ?? null);
      setLongitude(data.longitude ?? null);
      setTags(data.tags ?? []);

      const color = data.color || PRESET_COLORS[0];
      if (PRESET_COLORS.includes(color)) {
        setSelectedColor(color);
      } else {
        setCustomColor(color);
      }

      setLoading(false);
    }
    load();
  }, [id]);

  function handlePresetClick(color: string) {
    setSelectedColor(color);
    setCustomColor("");
  }

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

    const { data: updated, error: updateError } = await supabase
      .from("properties")
      .update({
        name: trimmedName,
        address: address.trim() || null,
        color: activeColor,
        tags,
        latitude,
        longitude,
      })
      .eq("id", id)
      .select("id");

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    // An empty result means RLS matched no rows — i.e. the current user isn't
    // allowed to edit this property. Without this check the save silently does
    // nothing and still redirects, looking like it "worked".
    if (!updated || updated.length === 0) {
      setError("You don't have permission to edit this property.");
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

    const { data: deleted, error: deleteError } = await supabase
      .from("properties")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");

    if (deleteError || !deleted || deleted.length === 0) {
      setError(
        deleteError?.message ??
          "You don't have permission to delete this property.",
      );
      setDeleting(false);
      setConfirmDelete(false);
      return;
    }

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
          <AddressInput
            value={address}
            onChange={setAddress}
            onSelect={(addr, lat, lng) => {
              setAddress(addr);
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
        </div>

        <div className="mb-5">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2">
            Tags
          </label>
          <TagInput tags={tags} onChange={setTags} allTags={allTags} />
        </div>

        <div className="mb-8">
          <label className="block font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-3">
            Color
          </label>
          <div className="flex items-center gap-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handlePresetClick(c)}
                className={`w-11 h-11 rounded-full transition-all ${
                  activeColor === c && !customColor
                    ? "ring-2 ring-offset-2 ring-offset-cream ring-plum scale-110"
                    : "hover:scale-105"
                }`}
                style={{ background: c }}
              />
            ))}
            <label
              className={`relative w-10 h-10 rounded-full cursor-pointer transition-all overflow-hidden border-2 border-dashed border-stone hover:border-plum ${
                customColor ? "ring-2 ring-offset-2 ring-offset-cream ring-plum scale-110 border-solid !border-transparent" : ""
              }`}
              style={customColor ? { background: customColor } : undefined}
            >
              {!customColor && (
                <span className="absolute inset-0 flex items-center justify-center text-stone text-[16px] leading-none">+</span>
              )}
              <input
                type="color"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={customColor || "#888888"}
                onChange={(e) => setCustomColor(e.target.value)}
              />
            </label>
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
