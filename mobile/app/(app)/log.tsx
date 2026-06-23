import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { createLog, getProperties, type Property } from "@/lib/db";
import { pickReceipt, uploadReceipt, type PickedPhoto } from "@/lib/photos";
import { Empty, MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function LogScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [hours, setHours] = useState("");
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function attach(source: "camera" | "library") {
    const p = await pickReceipt(source);
    if (p) setPhoto(p);
  }

  useFocusEffect(
    useCallback(() => {
      getProperties().then((p) => {
        setProperties(p);
        setPropertyId((cur) => cur ?? p[0]?.id ?? null);
      });
    }, []),
  );

  async function handleSave() {
    setError(null);
    setSaved(false);
    const h = parseFloat(hours);
    if (!propertyId) return setError("Pick a property.");
    if (!h || h <= 0) return setError("Enter how many hours.");
    setBusy(true);
    const { id, error } = await createLog(uid!, propertyId, task, h);
    if (error || !id) {
      setBusy(false);
      return setError(error ?? "Could not save entry.");
    }
    if (photo) {
      const up = await uploadReceipt(id, photo);
      if (up.error) {
        setBusy(false);
        return setError(`Entry saved, but the receipt failed: ${up.error}`);
      }
    }
    setBusy(false);
    setSaved(true);
    setTask("");
    setHours("");
    setPhoto(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        <SectionLabel>Manual entry</SectionLabel>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>
          Log hours.
        </Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}
        {saved && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.successBg }}>
            <Text style={{ color: colors.success, fontSize: 13 }}>Saved. Logged to your hours.</Text>
          </View>
        )}

        <MetricLabel>Property</MetricLabel>
        {properties.length === 0 ? (
          <Empty message="No properties yet." />
        ) : (
          <View style={{ gap: space(2), marginBottom: space(6) }}>
            {properties.map((p) => {
              const selected = p.id === propertyId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setPropertyId(p.id)}
                  style={{ flexDirection: "row", alignItems: "center", gap: space(3), padding: space(4), borderRadius: radius.md, borderWidth: 1.5, borderColor: selected ? colors.plum : colors.chalk, backgroundColor: selected ? colors.plumMist : colors.cream }}
                >
                  <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                  <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>{p.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <MetricLabel>Hours</MetricLabel>
        <TextInput
          value={hours}
          onChangeText={setHours}
          placeholder="e.g. 2.5"
          placeholderTextColor={colors.stone}
          keyboardType="decimal-pad"
          style={inputStyle}
        />

        <View style={{ height: space(5) }} />
        <MetricLabel>Task</MetricLabel>
        <TextInput
          value={task}
          onChangeText={setTask}
          placeholder="What did you work on?"
          placeholderTextColor={colors.stone}
          style={inputStyle}
        />

        <View style={{ height: space(5) }} />
        <MetricLabel>Receipt (optional)</MetricLabel>
        {photo ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space(3.5), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flex: 1 }}>
              <Ionicons name="image-outline" size={18} color={colors.plum} />
              <Text style={{ fontSize: 13, color: colors.char, flex: 1 }} numberOfLines={1}>{photo.name}</Text>
            </View>
            <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={20} color={colors.stone} />
            </Pressable>
          </View>
        ) : (
          <View style={{ flexDirection: "row", gap: space(3) }}>
            <Pressable onPress={() => attach("camera")} style={attachBtn}>
              <Ionicons name="camera-outline" size={18} color={colors.plum} />
              <Text style={attachLabel}>Camera</Text>
            </Pressable>
            <Pressable onPress={() => attach("library")} style={attachBtn}>
              <Ionicons name="images-outline" size={18} color={colors.plum} />
              <Text style={attachLabel}>Library</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={handleSave}
          disabled={busy}
          style={{ marginTop: space(7), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Save entry</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: space(4),
  borderWidth: 1,
  borderColor: colors.chalk,
  borderRadius: radius.md,
  fontSize: 15,
  color: colors.char,
} as const;

const attachBtn = {
  flex: 1,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: space(2),
  minHeight: 48,
  borderWidth: 1,
  borderColor: colors.chalk,
  borderRadius: radius.md,
};

const attachLabel = {
  fontFamily: fonts.mono,
  fontSize: 11,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  color: colors.plum,
};
