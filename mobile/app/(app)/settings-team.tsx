import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { getMyTeamOwner } from "@/lib/db";
import { canManageTeam, roleDisplayName } from "@/lib/permissions";
import { getManagedTeamData, type ManagedTeamData } from "@/lib/team-api";
import { Empty, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function TeamScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [team, setTeam] = useState<ManagedTeamData | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid) return;
        try {
          const { ownerId: oid, role } = await getMyTeamOwner(uid);
          if (!canManageTeam(role)) {
            router.replace("/settings");
            return;
          }
          const res = await getManagedTeamData(oid);
          if (!active) return;
          if (res.error || !res.data) {
            setError(res.error ?? "Could not load the team.");
          } else {
            setOwnerId(oid);
            setTeam(res.data);
            setError(null);
          }
        } catch (e: any) {
          if (active) setError(e?.message ?? "Could not load the team.");
        }
        if (active) setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [uid]),
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.plum} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Team</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(5) }}>
          Your team
        </Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {team && (
          <>
            <Pressable
              onPress={() => router.push({ pathname: "/team-invite", params: { owner: ownerId! } })}
              style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(5) }}
            >
              <Ionicons name="add" size={16} color={colors.plum} />
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.plum, textDecorationLine: "underline" }}>
                Invite member
              </Text>
            </Pressable>

            {/* Owner row (not editable) */}
            <View style={memberRow}>
              <View style={{ flex: 1, paddingRight: space(3) }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>
                  {team.ownerName || team.ownerEmail}
                </Text>
                <Text style={{ fontSize: 12, color: colors.slate }}>{team.ownerEmail}</Text>
              </View>
              <RoleChip label="Owner" />
            </View>

            {team.members.length === 0 ? (
              <Empty message="No team members yet. Invite your spouse, manager, or helpers." />
            ) : (
              team.members.map((m) => {
                const name =
                  m.memberName ??
                  `${m.first_name ?? ""} ${m.last_name ?? ""}`.trim() ??
                  m.email;
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => router.push({ pathname: "/team-member", params: { id: m.id, owner: ownerId! } })}
                    style={memberRow}
                  >
                    <View style={{ flex: 1, paddingRight: space(3) }}>
                      <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }} numberOfLines={1}>
                        {name || m.email}
                      </Text>
                      <Text style={{ fontSize: 12, color: colors.slate }} numberOfLines={1}>
                        {m.email}
                        {m.status === "pending" ? " · Invite pending" : ""}
                      </Text>
                    </View>
                    <RoleChip label={roleDisplayName(m.role, m.display_role)} pending={m.status === "pending"} />
                    <Ionicons name="chevron-forward" size={16} color={colors.stone} style={{ marginLeft: space(2) }} />
                  </Pressable>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleChip({ label, pending }: { label: string; pending?: boolean }) {
  const color = pending ? colors.slate : colors.tangerine;
  return (
    <View style={{ borderWidth: 1, borderColor: color, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color }}>
        {label}
      </Text>
    </View>
  );
}

const memberRow = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: space(4),
  borderBottomWidth: 1,
  borderBottomColor: colors.chalk,
} as const;
