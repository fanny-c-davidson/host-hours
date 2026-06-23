import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  canWriteProperties,
  getMyAutoTimer,
  getMyRole,
  getProfile,
  isStaff as isStaffRole,
  setMyAutoTimer,
  type TeamRole,
} from "@/lib/db";
import { Card, MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  spouse: "Spouse",
  manager: "Manager",
  employee: "Helper",
};

export default function SettingsScreen() {
  const { session, signOut } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [role, setRole] = useState<TeamRole>("owner");
  const [year, setYear] = useState(new Date().getFullYear());
  const [goal, setGoal] = useState(500);
  const [target, setTarget] = useState<string | null>("500");
  const [autoTimer, setAutoTimer] = useState(false);
  const [defaultTask, setDefaultTask] = useState("");
  const [savingAuto, setSavingAuto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid) return;
        const r = await getMyRole(uid);
        const [profile, at] = await Promise.all([getProfile(uid), getMyAutoTimer(uid, r)]);
        if (!active) return;
        setRole(r);
        setName(profile?.full_name || session?.user.email || "");
        setYear(profile?.tax_year ?? new Date().getFullYear());
        setGoal(profile?.goal_hours ?? 500);
        setTarget(profile?.target_test ?? "500");
        setAutoTimer(at.enabled);
        setDefaultTask(at.defaultTask);
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [uid, session]),
  );

  async function saveAuto(enabled: boolean, task: string) {
    setAutoTimer(enabled);
    setDefaultTask(task);
    setSavingAuto(true);
    await setMyAutoTimer(enabled, task);
    setSavingAuto(false);
  }

  const staff = isStaffRole(role);
  const email = session?.user.email ?? "";
  const initials = name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        <SectionLabel>Settings</SectionLabel>

        {/* Profile */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(4), marginBottom: space(6) }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.cream, fontFamily: fonts.serif, fontSize: 22 }}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 19, color: colors.char }}>{name}</Text>
            <Text style={{ fontSize: 12, color: colors.slate }}>{email}</Text>
          </View>
          <View style={{ borderWidth: 1, borderColor: colors.tangerine, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: colors.tangerine }}>{ROLE_LABEL[role]}</Text>
          </View>
        </View>

        {/* Target & Goal */}
        <Card style={{ marginBottom: space(4) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <MetricLabel>Tax year</MetricLabel>
              <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.char }}>{year}</Text>
            </View>
            <View>
              <MetricLabel>Goal</MetricLabel>
              <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.char }}>{goal} hr</Text>
            </View>
            {!staff && (
              <View>
                <MetricLabel>Target</MetricLabel>
                <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.char }}>
                  {target === "substantially" ? "Subst." : `${target} hr`}
                </Text>
              </View>
            )}
          </View>
        </Card>

        {/* Auto-timer */}
        <Card style={{ marginBottom: space(4) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1, paddingRight: space(3) }}>
              <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Auto start/stop</Text>
              <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(1) }}>
                Start the timer when you arrive at a property and stop when you leave.
              </Text>
            </View>
            <Switch
              value={autoTimer}
              onValueChange={(v) => saveAuto(v, defaultTask)}
              trackColor={{ true: colors.plum, false: colors.stone }}
              thumbColor={colors.cream}
            />
          </View>
          {autoTimer && (
            <View style={{ marginTop: space(4) }}>
              <MetricLabel>Default task</MetricLabel>
              <TextInput
                value={defaultTask}
                onChangeText={setDefaultTask}
                onBlur={() => saveAuto(autoTimer, defaultTask)}
                placeholder="e.g. Cleaning"
                placeholderTextColor={colors.stone}
                style={{ minHeight: 44, paddingHorizontal: space(4), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md, fontSize: 15, color: colors.char }}
              />
            </View>
          )}
          {savingAuto && <Text style={{ fontSize: 11, color: colors.slate, marginTop: space(2) }}>Saving…</Text>}
        </Card>

        {/* Properties (owner + spouse) */}
        {canWriteProperties(role) && (
          <Pressable onPress={() => router.push("/properties")} style={rowLink}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Manage properties</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.stone} />
          </Pressable>
        )}

        {/* Sign out */}
        <Pressable
          onPress={signOut}
          style={{ marginTop: space(8), minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.chalk, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill }}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const rowLink = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: space(4),
  borderTopWidth: 1,
  borderTopColor: colors.chalk,
} as const;
