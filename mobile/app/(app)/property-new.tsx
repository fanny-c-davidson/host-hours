import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  canWriteProperties,
  countActiveProperties,
  createProperty,
  getActiveTier,
  getMyRole,
  PLAN_MAX_PROPERTIES,
} from "@/lib/db";
import { AddressInput } from "@/components/address-input";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const PRESET_COLORS = ["#4A148C", "#FF6B35", "#0F6E56", "#5F5E5A", "#1565C0", "#AD1457", "#F9A825", "#00695C"];

export default function NewPropertyScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owners/spouses only — bounce others out (matches web).
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getMyRole(uid).then((role) => {
        if (!canWriteProperties(role)) router.replace("/properties");
      });
    }, [uid]),
  );

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError("Give the property a name.");
    setBusy(true);
    // Plan gate (mirrors web requirePropertySlot): starter caps at 3 properties.
    const [tier, count] = await Promise.all([getActiveTier(uid!), countActiveProperties()]);
    const max = PLAN_MAX_PROPERTIES[tier ?? "starter"];
    if (count >= max) {
      setBusy(false);
      return setError(
        `Your plan allows up to ${max} properties. Upgrade your plan on the web to add more.`,
      );
    }
    const { error } = await createProperty(uid!, name, address, color, coords);
    setBusy(false);
    if (error) return setError(error);
    router.replace("/properties");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>New property</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>Add a property.</Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <MetricLabel>Name</MetricLabel>
        <TextInput value={name} onChangeText={setName} placeholder="Beach House" placeholderTextColor={colors.stone} style={inputStyle} />

        <View style={{ height: space(5) }} />
        <MetricLabel>Address (optional)</MetricLabel>
        <AddressInput
          value={address}
          onChange={setAddress}
          onSelect={(addr, lat, lng) => {
            setAddress(addr);
            setCoords({ latitude: lat, longitude: lng });
          }}
        />

        <View style={{ height: space(5) }} />
        <MetricLabel>Color</MetricLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>
          {PRESET_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: colors.char }}
            />
          ))}
        </View>

        <Pressable
          onPress={handleSave}
          disabled={busy}
          style={{ marginTop: space(8), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Add property</Text>}
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
