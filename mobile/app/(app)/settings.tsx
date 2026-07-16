import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  canWriteProperties,
  createTaskType,
  getMyAutoTimer,
  getMyRole,
  getProfile,
  getTaskTypes,
  isStaff as isStaffRole,
  setMyAutoTimer,
  type TaskType,
  type TeamRole,
} from "@/lib/db";
import { Card, MetricLabel, SectionLabel } from "@/components/app-ui";
import { authenticate, isBiometricAvailable, isBiometricEnabled, setBiometricEnabled } from "@/lib/biometric";
import { syncGeofences } from "@/lib/geofence";
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
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [taskPickerOpen, setTaskPickerOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [savingAuto, setSavingAuto] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioOn, setBioOn] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid) return;
        const r = await getMyRole(uid);
        const [profile, at, bioAvail, bioEnabled, types] = await Promise.all([
          getProfile(uid),
          getMyAutoTimer(uid, r),
          isBiometricAvailable(),
          isBiometricEnabled(),
          getTaskTypes(),
        ]);
        if (!active) return;
        setRole(r);
        setBioAvailable(bioAvail);
        setBioOn(bioEnabled);
        setName(profile?.full_name || session?.user.email || "");
        setYear(profile?.tax_year ?? new Date().getFullYear());
        setGoal(profile?.goal_hours ?? 500);
        setTarget(profile?.target_test ?? "500");
        setAutoTimer(at.enabled);
        setDefaultTask(at.defaultTask);
        setTaskTypes(types);
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
    // Reconcile geofences (requests background-location permission when enabling).
    if (uid) await syncGeofences(uid).catch(() => {});
    setSavingAuto(false);
  }

  // Create a task type and make it the auto-timer default in one step.
  async function addAndSelectTask() {
    const name = newTaskName.trim();
    if (!name || !uid) return;
    const existing = taskTypes.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!existing) {
      const maxOrder = taskTypes.length > 0 ? Math.max(...taskTypes.map((t) => t.sort_order)) + 1 : 0;
      const created = await createTaskType(uid, name, maxOrder);
      if (created) setTaskTypes((prev) => [...prev, created]);
    }
    setNewTaskName("");
    setAddingTask(false);
    setTaskPickerOpen(false);
    await saveAuto(autoTimer, existing?.name ?? name);
  }

  async function toggleBiometric(next: boolean) {
    // Require a successful prompt before enabling, so users can't lock out.
    if (next && !(await authenticate())) return;
    await setBiometricEnabled(next);
    setBioOn(next);
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
        <Pressable onPress={() => router.push("/settings-profile")} style={{ flexDirection: "row", alignItems: "center", gap: space(4), marginBottom: space(6) }}>
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
          <Ionicons name="chevron-forward" size={16} color={colors.stone} />
        </Pressable>

        {/* Target & Goal — tap to edit (mirrors web /settings/tax) */}
        <Pressable onPress={() => router.push("/settings-tax")}>
        <Card style={{ marginBottom: space(4) }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
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
            <Ionicons name="chevron-forward" size={16} color={colors.stone} />
          </View>
        </Card>
        </Pressable>

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

              {/* Dropdown field */}
              <Pressable
                onPress={() => setTaskPickerOpen((v) => !v)}
                style={{
                  minHeight: 44,
                  paddingHorizontal: space(4),
                  borderWidth: 1,
                  borderColor: taskPickerOpen ? colors.plum : colors.chalk,
                  borderRadius: radius.md,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 15, color: defaultTask ? colors.char : colors.stone }}>
                  {defaultTask || "Choose a task type…"}
                </Text>
                <Ionicons name={taskPickerOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.quill} />
              </Pressable>

              {/* Options */}
              {taskPickerOpen && (
                <View style={{ marginTop: space(2), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md, overflow: "hidden" }}>
                  {taskTypes.map((t, i) => {
                    const selected = t.name === defaultTask;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => {
                          setTaskPickerOpen(false);
                          setAddingTask(false);
                          saveAuto(autoTimer, t.name);
                        }}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          paddingHorizontal: space(4),
                          paddingVertical: space(3),
                          borderBottomWidth: 1,
                          borderBottomColor: colors.chalk,
                          backgroundColor: selected ? colors.plumMist : colors.cream,
                        }}
                      >
                        <Text style={{ fontSize: 14, color: colors.char }}>{t.name}</Text>
                        {selected && <Ionicons name="checkmark" size={16} color={colors.plum} />}
                      </Pressable>
                    );
                  })}

                  {/* Add a new task type inline */}
                  {!addingTask ? (
                    <Pressable
                      onPress={() => setAddingTask(true)}
                      style={{ flexDirection: "row", alignItems: "center", gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3) }}
                    >
                      <Ionicons name="add" size={16} color={colors.plum} />
                      <Text style={{ fontSize: 14, fontWeight: "500", color: colors.plum }}>Add new task type</Text>
                    </Pressable>
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), paddingHorizontal: space(3), paddingVertical: space(2.5) }}>
                      <TextInput
                        value={newTaskName}
                        onChangeText={setNewTaskName}
                        onSubmitEditing={() => addAndSelectTask()}
                        autoFocus
                        placeholder="New task type"
                        placeholderTextColor={colors.stone}
                        style={{ flex: 1, minHeight: 38, paddingHorizontal: space(3), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.sm, fontSize: 14, color: colors.char }}
                      />
                      <Pressable
                        onPress={() => addAndSelectTask()}
                        style={{ minHeight: 38, paddingHorizontal: space(3.5), borderRadius: radius.sm, backgroundColor: colors.plum, justifyContent: "center" }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.cream }}>Add</Text>
                      </Pressable>
                      <Pressable onPress={() => { setAddingTask(false); setNewTaskName(""); }} hitSlop={6}>
                        <Text style={{ fontSize: 13, color: colors.quill }}>Cancel</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
          {savingAuto && <Text style={{ fontSize: 11, color: colors.slate, marginTop: space(2) }}>Saving…</Text>}
        </Card>

        {/* Biometric unlock */}
        {bioAvailable && (
          <Card style={{ marginBottom: space(4) }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1, paddingRight: space(3) }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Biometric unlock</Text>
                <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(1) }}>
                  Require Face ID / fingerprint to open the app.
                </Text>
              </View>
              <Switch value={bioOn} onValueChange={toggleBiometric} trackColor={{ true: colors.plum, false: colors.stone }} thumbColor={colors.cream} />
            </View>
          </Card>
        )}

        {/* Properties (owner + spouse) */}
        {canWriteProperties(role) && (
          <Pressable onPress={() => router.push("/properties")} style={rowLink}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Manage properties</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.stone} />
          </Pressable>
        )}

        {/* Team management — owner, spouse, manager (matches web permission matrix) */}
        {role !== "employee" && (
          <Pressable onPress={() => router.push("/settings-team")} style={rowLink}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Manage team</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.stone} />
          </Pressable>
        )}

        {/* Billing — owner only (matches web permission matrix) */}
        {role === "owner" && (
          <Pressable onPress={() => router.push("/settings-billing")} style={rowLink}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Plan & billing</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.stone} />
          </Pressable>
        )}

        <Pressable onPress={() => router.push("/settings-password")} style={rowLink}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Change password</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.stone} />
        </Pressable>

        <Pressable onPress={() => router.push("/settings-contact")} style={rowLink}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>Contact us</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.stone} />
        </Pressable>

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
