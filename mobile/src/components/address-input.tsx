import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { colors, radius, space } from "@/theme/tokens";

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

type MapboxFeature = {
  place_name: string;
  center: [number, number]; // [lng, lat]
};

// Debounced Mapbox address autocomplete (same API + params as the web app).
// Selecting a suggestion reports the coordinates the geofence engine needs.
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
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function handleChange(text: string) {
    onChange(text);
    clearTimeout(timer.current);
    if (text.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(text)}.json?access_token=${MAPBOX_TOKEN}&country=us&types=address&limit=5&autocomplete=true`,
        );
        const data: { features?: MapboxFeature[] } = await res.json();
        setSuggestions(data.features ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function handleSelect(f: MapboxFeature) {
    setSuggestions([]);
    onChange(f.place_name);
    onSelect?.(f.place_name, f.center[1], f.center[0]);
  }

  return (
    <View>
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder="Start typing an address…"
        placeholderTextColor={colors.stone}
        autoComplete="off"
        autoCorrect={false}
        style={{
          minHeight: 48,
          paddingHorizontal: space(4),
          borderWidth: 1,
          borderColor: colors.chalk,
          borderRadius: radius.md,
          fontSize: 15,
          color: colors.char,
        }}
      />
      {suggestions.length > 0 && (
        <View
          style={{
            marginTop: space(1),
            borderWidth: 1,
            borderColor: colors.chalk,
            borderRadius: radius.md,
            backgroundColor: colors.cream,
            overflow: "hidden",
          }}
        >
          {suggestions.map((f, i) => (
            <Pressable
              key={i}
              onPress={() => handleSelect(f)}
              style={{
                paddingHorizontal: space(4),
                paddingVertical: space(3),
                borderBottomWidth: i < suggestions.length - 1 ? 1 : 0,
                borderBottomColor: colors.chalk,
              }}
            >
              <Text style={{ fontSize: 14, color: colors.char }}>{f.place_name}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
