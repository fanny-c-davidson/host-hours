import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { createLog, getProperties, type Property } from "@/lib/db";
import { Empty, MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function LogScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [properties, setProperties] = useState<Property[]>([]);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [hours, setHours] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    const { error } = await createLog(uid!, propertyId, task, h);
    setBusy(false);
    if (error) return setError(error);
    setSaved(true);
    setTask("");
    setHours("");
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
