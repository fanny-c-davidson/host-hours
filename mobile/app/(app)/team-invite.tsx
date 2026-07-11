import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { getMyTeamOwner, type TeamRole } from "@/lib/db";
import { manageableRoles, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";
import { getManagedTeamData, inviteTeamMember } from "@/lib/team-api";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function TeamInviteScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const { owner } = useLocalSearchParams<{ owner: string }>();

  const [callerRole, setCallerRole] = useState<TeamRole>("owner");
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("employee");
  const [displayRole, setDisplayRole] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getMyTeamOwner(uid).then(({ role: r }) => setCallerRole(r));
      if (owner) {
        getManagedTeamData(owner)
          .then((res) => {
            if (res.data) setProperties(res.data.properties);
          })
          .catch(() => {});
      }
    }, [uid, owner]),
  );

  const roles = manageableRoles(callerRole);

  function toggleProperty(id: string) {
    setPropertyIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function handleInvite() {
    setError(null);
    if (!email.trim()) return setError("Enter an email address.");
    setBusy(true);
    try {
      const res = await inviteTeamMember({
        email: email.trim().toLowerCase(),
        role,
        propertyIds,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayRole: displayRole.trim(),
        ownerId: owner,
      });
      setBusy(false);
      if (res.error) return setError(res.error);
      router.back();
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not send the invitation.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Team</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>
          Invite a member.
        </Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", gap: space(3) }}>
          <View style={{ flex: 1 }}>
            <MetricLabel>First name</MetricLabel>
            <TextInput value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.stone} style={inputStyle} />
          </View>
          <View style={{ flex: 1 }}>
            <MetricLabel>Last name</MetricLabel>
            <TextInput value={lastName} onChangeText={setLastName} placeholderTextColor={colors.stone} style={inputStyle} />
          </View>
        </View>

        <View style={{ height: space(5) }} />
        <MetricLabel>Email</MetricLabel>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="teammate@example.com"
          placeholderTextColor={colors.stone}
          style={inputStyle}
        />

        <View style={{ height: space(5) }} />
        <MetricLabel>Role</MetricLabel>
        <View style={{ gap: space(2) }}>
          {roles.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRole(r)}
              style={{
                padding: space(4),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: role === r ? colors.plum : colors.chalk,
                backgroundColor: role === r ? colors.plumMist : colors.cream,
              }}
            >
              <Text style={{ fontFamily: fonts.serif, fontSize: 16, fontWeight: "500", color: colors.char }}>
                {ROLE_LABELS[r]}
              </Text>
              <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(1), lineHeight: 17 }}>
                {ROLE_DESCRIPTIONS[r]}
              </Text>
            </Pressable>
          ))}
        </View>

        {(role === "manager" || role === "employee") && (
          <>
            <View style={{ height: space(5) }} />
            <MetricLabel>Display role (optional)</MetricLabel>
            <TextInput
              value={displayRole}
              onChangeText={setDisplayRole}
              placeholder="e.g. Cleaner, Handyman"
              placeholderTextColor={colors.stone}
              style={inputStyle}
            />
          </>
        )}

        {properties.length > 0 && (
          <>
            <View style={{ height: space(5) }} />
            <MetricLabel>Assigned properties</MetricLabel>
            <View style={{ gap: space(2) }}>
              {properties.map((p) => {
                const selected = propertyIds.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => toggleProperty(p.id)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space(3),
                      padding: space(3.5),
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: selected ? colors.plum : colors.chalk,
                      backgroundColor: selected ? colors.plumMist : colors.cream,
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={18}
                      color={selected ? colors.plum : colors.stone}
                    />
                    <Text style={{ fontSize: 14, color: colors.char }}>{p.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Pressable
          onPress={handleInvite}
          disabled={busy}
          style={{ marginTop: space(8), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Send invitation</Text>}
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
