import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  getMyTeamOwner,
  getProfile,
  getTeamRoster,
  type TeamRosterMember,
  type TeamRole,
} from "@/lib/db";
import { canManageMember, canManageTeam, ROLE_LABELS, roleDisplayName } from "@/lib/permissions";
import { removeTeamMember } from "@/lib/team-api";
import { Empty, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function TeamScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [callerRole, setCallerRole] = useState<TeamRole>("owner");
  const [members, setMembers] = useState<TeamRosterMember[]>([]);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid) return;
        const { ownerId: oid, role } = await getMyTeamOwner(uid);
        if (!canManageTeam(role)) {
          router.replace("/settings");
          return;
        }
        // Roster + owner profile read directly under RLS — works even when
        // the web bridge is unreachable (mutations still need it).
        const [ownerProfile, roster] = await Promise.all([
          getProfile(oid).catch(() => null),
          getTeamRoster(oid),
        ]);
        if (!active) return;
        setOwnerId(oid);
        setCallerRole(role);
        setOwnerName(ownerProfile?.full_name ?? "");
        setOwnerEmail(ownerProfile?.email ?? "");
        setMembers(roster.filter((m) => m.member_id !== oid));
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [uid]),
  );

  const isOwnTeam = ownerId === uid;

  async function handleRemove(m: TeamRosterMember) {
    if (confirmRemoveId !== m.id) {
      setConfirmRemoveId(m.id);
      return;
    }
    setError(null);
    setRemovingId(m.id);
    try {
      // keepHours: true preserves the member's logged hours for tax records.
      const res = await removeTeamMember(m.id, true, ownerId ?? undefined);
      if (res.error) {
        setError(res.error);
      } else {
        setMembers((cur) => cur.filter((x) => x.id !== m.id));
      }
    } catch (e: any) {
      setError(e?.message ?? "Could not remove the member.");
    }
    setRemovingId(null);
    setConfirmRemoveId(null);
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
      <ScrollView contentContainerStyle={{ paddingBottom: space(12) }}>
        <View style={{ paddingHorizontal: space(7), paddingTop: space(4), paddingBottom: space(5), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.quill} />
            </Pressable>
            <SectionLabel>Team</SectionLabel>
          </View>
          <Text style={{ fontFamily: fonts.serif, fontSize: 30, color: colors.plum, letterSpacing: -0.5 }}>
            {isOwnTeam ? "Your team." : `${ownerName || "Owner"}'s team.`}
          </Text>
          {!isOwnTeam && (
            <Text style={{ fontSize: 14, color: colors.quill, marginTop: space(2) }}>
              You're a {roleDisplayName(callerRole).toLowerCase()} on this team.
            </Text>
          )}
        </View>

        {error && (
          <View style={{ marginHorizontal: space(7), marginTop: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Owner row */}
        <View style={memberRow}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 19, fontWeight: "500", color: colors.char }}>
            {ownerName || ownerEmail}
            {isOwnTeam ? <Text style={{ fontStyle: "italic", fontWeight: "400", color: colors.quill }}>  (you)</Text> : null}
          </Text>
          <Text style={{ fontSize: 13, color: colors.slate, marginTop: space(1) }}>{ownerEmail}</Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.plum, fontWeight: "500", marginTop: space(2) }}>
            {ROLE_LABELS.owner}
          </Text>
        </View>

        {/* Member rows */}
        {members.length === 0 ? (
          <Empty message="No team members yet. Invite your spouse, manager, or helpers." />
        ) : (
          members.map((m) => {
            const isYou = m.member_id === uid;
            const name = m.memberName || `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() || m.email;
            const editable = isYou || canManageMember(callerRole, m.role);
            const removable = !isYou && canManageMember(callerRole, m.role);
            const pending = m.status === "pending";
            return (
              <View key={m.id} style={memberRow}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flex: 1, paddingRight: space(3) }}>
                    <Text style={{ fontFamily: fonts.serif, fontSize: 19, fontWeight: "500", color: colors.char }} numberOfLines={1}>
                      {name}
                      {isYou ? <Text style={{ fontStyle: "italic", fontWeight: "400", color: colors.quill }}>  (you)</Text> : null}
                    </Text>
                    <View style={{ paddingHorizontal: space(2.5), paddingVertical: 2, borderRadius: radius.pill, backgroundColor: pending ? colors.vellum : colors.successBg }}>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: "500", color: pending ? colors.slate : colors.success }}>
                        {pending ? "Pending" : "Active"}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space(4) }}>
                    {editable && (
                      <Pressable onPress={() => router.push({ pathname: "/team-member", params: { id: m.id, owner: ownerId! } })} hitSlop={8}>
                        <Text style={actionLink(colors.quill)}>Edit</Text>
                      </Pressable>
                    )}
                    {removable && (
                      <Pressable onPress={() => handleRemove(m)} hitSlop={8} disabled={removingId === m.id}>
                        {removingId === m.id ? (
                          <ActivityIndicator size="small" color={colors.tangerine} />
                        ) : (
                          <Text style={actionLink(colors.tangerine)}>
                            {confirmRemoveId === m.id ? "Confirm?" : "Remove"}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </View>
                </View>
                <Text style={{ fontSize: 13, color: colors.slate, marginTop: space(1) }} numberOfLines={1}>
                  {m.email}
                </Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.plum, fontWeight: "500", marginTop: space(2) }}>
                  {roleDisplayName(m.role, m.display_role)}
                  {(m.role === "manager" || m.role === "employee") && m.propertyIds.length > 0 && (
                    <Text style={{ color: colors.slate, textTransform: "none", letterSpacing: 0 }}>
                      {"  "}· {m.propertyIds.length} {m.propertyIds.length === 1 ? "property" : "properties"}
                    </Text>
                  )}
                </Text>
              </View>
            );
          })
        )}

        {/* Invite */}
        <View style={{ paddingHorizontal: space(7), paddingTop: space(6) }}>
          <Pressable
            onPress={() => router.push({ pathname: "/team-invite", params: { owner: ownerId! } })}
            style={{ minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.plum, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: colors.plum, fontWeight: "500" }}>
              + Invite team member
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const memberRow = {
  paddingHorizontal: space(7),
  paddingVertical: space(5),
  borderBottomWidth: 1,
  borderBottomColor: colors.chalk,
} as const;

const actionLink = (color: string) =>
  ({
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    color,
  }) as const;
