import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { getProfile, updateProfileName } from "@/lib/db";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function EditProfileScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then((p) => {
      const fullName = p?.full_name ?? "";
      const parts = fullName.split(" ").filter(Boolean);
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" "));
      setEmail(p?.email ?? session?.user.email ?? "");
      setLoading(false);
    });
  }, [uid]);

  const initials =
    `${firstName.trim()[0] ?? ""}${lastName.trim()[0] ?? ""}`.toUpperCase() || "?";

  async function handleSave() {
    setError(null);
    setSaved(false);
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) return setError("Name is required.");
    if (!email.trim()) return setError("Email is required.");
    setBusy(true);
    const { error: err } = await updateProfileName(uid!, fullName, email.trim());
    setBusy(false);
    if (err) return setError(err);
    setSaved(true);
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.plum} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Profile</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>Edit profile.</Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}
        {saved && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.successBg }}>
            <Text style={{ color: colors.success, fontSize: 13 }}>Profile updated.</Text>
          </View>
        )}

        <View style={{ alignItems: "flex-start", marginBottom: space(6) }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.cream, fontFamily: fonts.serif, fontSize: 28 }}>{initials}</Text>
          </View>
        </View>

        <MetricLabel>First name</MetricLabel>
        <TextInput value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.stone} style={inputStyle} />

        <View style={{ height: space(5) }} />
        <MetricLabel>Last name</MetricLabel>
        <TextInput value={lastName} onChangeText={setLastName} placeholderTextColor={colors.stone} style={inputStyle} />

        <View style={{ height: space(5) }} />
        <MetricLabel>Email</MetricLabel>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholderTextColor={colors.stone}
          style={inputStyle}
        />

        <Pressable
          onPress={handleSave}
          disabled={busy}
          style={{ marginTop: space(8), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Save changes</Text>}
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
