import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { getMyTeamOwner, type TeamRole } from "@/lib/db";
import { canManageMember, manageableRoles, ROLE_LABELS } from "@/lib/permissions";
import {
  getManagedTeamData,
  removeTeamMember,
  resendInvitation,
  updatePropertyAssignments,
  updateTeamMemberEmail,
  updateTeamMemberName,
  updateTeamMemberRole,
  type ManagedTeamMember,
} from "@/lib/team-api";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function TeamMemberScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const { id, owner } = useLocalSearchParams<{ id: string; owner: string }>();

  const [loading, setLoading] = useState(true);
  const [member, setMember] = useState<ManagedTeamMember | null>(null);
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [callerRole, setCallerRole] = useState<TeamRole>("owner");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("employee");
  const [displayRole, setDisplayRole] = useState("");
  const [propertyIds, setPropertyIds] = useState<string[]>([]);

  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid || !id || !owner) return;
        const [{ role: myRole }, res] = await Promise.all([
          getMyTeamOwner(uid),
          getManagedTeamData(owner).catch(() => null),
        ]);
        if (!active) return;
        setCallerRole(myRole);
        const m = res?.data?.members.find((x) => x.id === id) ?? null;
        if (!m) {
          setError(res?.error ?? "Team member not found.");
        } else {
          setMember(m);
          setProperties(res!.data!.properties);
          setFirstName(m.first_name ?? "");
          setLastName(m.last_name ?? "");
          setEmail(m.email);
          setRole(m.role);
          setDisplayRole(m.display_role ?? "");
          setPropertyIds(m.propertyIds);
        }
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [uid, id, owner]),
  );

  const editable = member ? canManageMember(callerRole, member.role) : false;
  const roles = manageableRoles(callerRole);

  function toggleProperty(pid: string) {
    setPropertyIds((cur) => (cur.includes(pid) ? cur.filter((x) => x !== pid) : [...cur, pid]));
  }

  async function handleSave() {
    if (!member) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const results = await Promise.all([
        updateTeamMemberName(member.id, firstName.trim(), lastName.trim(), owner),
        email.trim().toLowerCase() !== member.email
          ? updateTeamMemberEmail(member.id, email.trim().toLowerCase(), owner)
          : Promise.resolve({ data: null, error: null }),
        role !== member.role || displayRole.trim() !== (member.display_role ?? "")
          ? updateTeamMemberRole(member.id, role, displayRole.trim(), owner)
          : Promise.resolve({ data: null, error: null }),
        updatePropertyAssignments(member.id, propertyIds, owner),
      ]);
      setBusy(false);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) return setError(firstError);
      setNotice("Saved.");
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not save changes.");
    }
  }

  async function handleResend() {
    if (!member) return;
    setError(null);
    setNotice(null);
    setResending(true);
    try {
      const res = await resendInvitation(member.id, owner);
      setResending(false);
      if (res.error) return setError(res.error);
      setNotice("Invitation re-sent.");
    } catch (e: any) {
      setResending(false);
      setError(e?.message ?? "Could not resend the invitation.");
    }
  }

  async function handleRemove() {
    if (!member) return;
    if (!confirmRemove) return setConfirmRemove(true);
    setError(null);
    setRemoving(true);
    try {
      // keepHours: true preserves the member's logged hours for tax records.
      const res = await removeTeamMember(member.id, true, owner);
      setRemoving(false);
      if (res.error) {
        setConfirmRemove(false);
        return setError(res.error);
      }
      router.back();
    } catch (e: any) {
      setRemoving(false);
      setConfirmRemove(false);
      setError(e?.message ?? "Could not remove the member.");
    }
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
          <SectionLabel>Team member</SectionLabel>
        </View>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}
        {notice && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.successBg }}>
            <Text style={{ color: colors.success, fontSize: 13 }}>{notice}</Text>
          </View>
        )}

        {member && (
          <>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(1) }}>
              {member.memberName || `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || member.email}
            </Text>
            <Text style={{ fontSize: 13, color: colors.slate, marginBottom: space(6) }}>
              {member.status === "pending" ? "Invitation pending" : "Active member"}
            </Text>

            {!editable ? (
              <Text style={{ fontSize: 13, color: colors.slate }}>
                You don't have permission to edit this member.
              </Text>
            ) : (
              <>
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
                  placeholderTextColor={colors.stone}
                  style={inputStyle}
                />

                <View style={{ height: space(5) }} />
                <MetricLabel>Role</MetricLabel>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
                  {roles.map((r) => (
                    <Pressable
                      key={r}
                      onPress={() => setRole(r)}
                      style={{
                        paddingHorizontal: space(4),
                        paddingVertical: space(2.5),
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: role === r ? colors.plum : colors.chalk,
                        backgroundColor: role === r ? colors.plumMist : colors.cream,
                      }}
                    >
                      <Text style={{ fontSize: 14, color: role === r ? colors.char : colors.quill }}>{ROLE_LABELS[r]}</Text>
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
                  onPress={handleSave}
                  disabled={busy}
                  style={{ marginTop: space(8), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
                >
                  {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Save changes</Text>}
                </Pressable>

                {member.status === "pending" && (
                  <Pressable
                    onPress={handleResend}
                    disabled={resending}
                    style={{ marginTop: space(3), minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.chalk, alignItems: "center", justifyContent: "center", opacity: resending ? 0.6 : 1 }}
                  >
                    {resending ? (
                      <ActivityIndicator color={colors.plum} />
                    ) : (
                      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500" }}>
                        Resend invitation
                      </Text>
                    )}
                  </Pressable>
                )}

                <Pressable
                  onPress={handleRemove}
                  disabled={removing}
                  style={{ marginTop: space(3), minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: confirmRemove ? colors.tangerine : colors.chalk, alignItems: "center", justifyContent: "center", opacity: removing ? 0.6 : 1 }}
                >
                  {removing ? (
                    <ActivityIndicator color={colors.tangerine} />
                  ) : (
                    <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine, fontWeight: "500" }}>
                      {confirmRemove ? "Tap again to confirm removal" : "Remove from team"}
                    </Text>
                  )}
                </Pressable>
              </>
            )}
          </>
        )}
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
