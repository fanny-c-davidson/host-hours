"use client";

import { useState, useRef, useEffect } from "react";

type MapboxFeature = {
  place_name: string;
  center: [number, number]; // [lng, lat]
};

type MapboxResponse = {
  features: MapboxFeature[];
};

export function AddressInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (address: string, lat: number, lng: number) => void;
}) {
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const sessionTokenRef = useRef(crypto.randomUUID());
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleChange(text: string) {
    onChange(text);

    if (timerRef.current) clearTimeout(timerRef.current);

    if (text.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      try {
        const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
        if (!token) return;

        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${token}&country=us&types=address&limit=5&autocomplete=true`,
        );
        const data: MapboxResponse = await res.json();
        setSuggestions(data.features || []);
        setOpen((data.features || []).length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function handleSelect(f: MapboxFeature) {
    onChange(f.place_name);
    setOpen(false);
    setSuggestions([]);
    sessionTokenRef.current = crypto.randomUUID();
    onSelect?.(f.place_name, f.center[1], f.center[0]);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-4 focus:ring-plum-mist placeholder:text-stone"
        placeholder="Start typing an address…"
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-cream border border-chalk rounded-md shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => handleSelect(f)}
                className="w-full text-left px-4 py-3 text-[14px] text-char hover:bg-plum-mist transition-colors border-b border-chalk last:border-b-0"
              >
                {f.place_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
