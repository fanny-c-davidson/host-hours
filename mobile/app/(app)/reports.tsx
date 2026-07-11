import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import { API_URL, emailCsvReport } from "@/lib/web-api";
import {
  getAllLogs,
  getMyRole,
  getProfile,
  getTeamMembers,
  getYearSeconds,
  isStaff as isStaffRole,
  type LogEntry,
  type TeamMember,
  type TeamRole,
} from "@/lib/db";
import { formatHours, shortDate } from "@/lib/format";
import { Card, Empty, MetricLabel, ProgressBar, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  spouse: "Spouse",
  manager: "Manager",
  employee: "Helper",
};

type Tab = "hours" | "activity" | "team" | "export";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Same columns and total row as the web export (minus the spouse "Logged by"
// column — mobile exports the caller's own activity).
function logsToCsv(logs: LogEntry[]): string {
  const headers = ["Date", "Start Time", "Hours", "Category", "Property", "Notes"];
  const rows = logs.map((entry) => {
    const d = new Date(entry.started_at);
    const date = d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return [
      date,
      time,
      (entry.duration_secs / 3600).toFixed(2),
      entry.title || "",
      entry.propertyName || "",
      entry.description || "",
    ]
      .map(escapeCsvField)
      .join(",");
  });
  const total = logs.reduce((s, e) => s + e.duration_secs, 0) / 3600;
  const totalRow = ["", "", total.toFixed(2), "TOTAL", "", ""].join(",");
  return [headers.join(","), ...rows, "", totalRow].join("\n");
}

export default function ReportsScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("hours");
  const [role, setRole] = useState<TeamRole>("owner");
  const [year, setYear] = useState(new Date().getFullYear());
  const [goal, setGoal] = useState(500);
  const [target, setTarget] = useState<string | null>("500");
  const [yearSecs, setYearSecs] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid) return;
        const r = await getMyRole(uid);
        const profile = await getProfile(uid);
        const ty = profile?.tax_year ?? new Date().getFullYear();
        const [secs, allLogs, members] = await Promise.all([
          getYearSeconds(uid, ty),
          getAllLogs(uid),
          r === "owner" || r === "spouse" ? getTeamMembers(uid) : Promise.resolve([]),
        ]);
        if (!active) return;
        setRole(r);
        setYear(ty);
        setGoal(profile?.goal_hours ?? 500);
        setTarget(profile?.target_test ?? "500");
        setYearSecs(secs);
        setLogs(allLogs);
        setTeam(members);
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [uid]),
  );

  const staff = isStaffRole(role);
  const hours = yearSecs / 3600;
  const tabs: { key: Tab; label: string }[] = [
    { key: "hours", label: "My Hours" },
    { key: "activity", label: "Activity" },
    ...(staff ? [] : [{ key: "team" as Tab, label: "Team" }, { key: "export" as Tab, label: "Export" }]),
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <View style={{ paddingHorizontal: space(7), paddingTop: space(4) }}>
        <SectionLabel>Reports</SectionLabel>
        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: space(6), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
          {tabs.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ paddingVertical: space(3), borderBottomWidth: 2, borderBottomColor: tab === t.key ? colors.plum : "transparent" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: tab === t.key ? colors.plum : colors.quill }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        {tab === "hours" && (
          <View style={{ gap: space(4) }}>
            <Card>
              <MetricLabel>{year} · Annual goal</MetricLabel>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: space(2), marginBottom: space(4) }}>
                <Text style={{ fontFamily: fonts.serif, fontSize: 36, color: colors.char }}>{formatHours(yearSecs)}</Text>
                <Text style={{ fontSize: 14, color: colors.slate }}>of {goal} hr</Text>
              </View>
              <ProgressBar pct={goal > 0 ? (hours / goal) * 100 : 0} />
            </Card>

            {!staff && target && (
              <Card>
                <MetricLabel>IRS target test</MetricLabel>
                <View style={{ flexDirection: "row", alignItems: "baseline", gap: space(2), marginBottom: space(4) }}>
                  <Text style={{ fontFamily: fonts.serif, fontSize: 36, color: colors.char }}>{formatHours(yearSecs)}</Text>
                  <Text style={{ fontSize: 14, color: colors.slate }}>
                    of {target === "substantially" ? "subst. all" : `${target} hr`}
                  </Text>
                </View>
                {target !== "substantially" && <ProgressBar pct={(hours / parseInt(target, 10)) * 100} />}
              </Card>
            )}
          </View>
        )}

        {tab === "activity" && (
          <View>
            {logs.length === 0 ? (
              <Empty message="No activity yet." />
            ) : (
              logs.map((log) => (
                <View key={log.id} style={rowStyle}>
                  <View style={{ flex: 1, paddingRight: space(3) }}>
                    <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.char }} numberOfLines={1}>{log.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.slate }}>{log.propertyName ?? "—"} · {shortDate(log.started_at)}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.plum }}>{formatHours(log.duration_secs)}h</Text>
                </View>
              ))
            )}
          </View>
        )}

        {tab === "export" && (
          <View style={{ gap: space(4) }}>
            {logs.length === 0 ? (
              <Empty message="Start logging hours to export your data." />
            ) : (
              <>
                <Card>
                  <MetricLabel>Tax report PDF</MetricLabel>
                  <Text style={{ fontSize: 13, color: colors.slate, marginBottom: space(4), lineHeight: 19 }}>
                    The full tax report PDF (with property breakdowns and receipt
                    thumbnails) is generated on the web app.
                  </Text>
                  <Pressable
                    onPress={() => Linking.openURL(`${API_URL}/reports?tab=export`)}
                    style={{ minHeight: 48, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text style={{ color: colors.cream, fontSize: 14, fontWeight: "500" }}>Open tax report on the web</Text>
                  </Pressable>
                </Card>

                <Card>
                  <MetricLabel>All activities</MetricLabel>
                  <Text style={{ fontSize: 13, color: colors.slate, marginBottom: space(4), lineHeight: 19 }}>
                    Email yourself a CSV of every logged activity.
                  </Text>
                  <Pressable
                    onPress={async () => {
                      const email = session?.user.email;
                      if (!email) return;
                      setEmailing(true);
                      setEmailStatus(null);
                      const { error } = await emailCsvReport(logsToCsv(logs), email, "All properties");
                      setEmailing(false);
                      setEmailStatus(error ? error : "Report sent to your email.");
                    }}
                    disabled={emailing}
                    style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.chalk, alignItems: "center", justifyContent: "center", opacity: emailing ? 0.6 : 1 }}
                  >
                    {emailing ? (
                      <ActivityIndicator color={colors.plum} />
                    ) : (
                      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500" }}>
                        Email All Activities CSV
                      </Text>
                    )}
                  </Pressable>
                  {emailStatus && (
                    <Text style={{ fontSize: 12, color: emailStatus.startsWith("Report sent") ? colors.success : colors.tangerine, textAlign: "center", marginTop: space(3) }}>
                      {emailStatus}
                    </Text>
                  )}
                </Card>
              </>
            )}
          </View>
        )}

        {tab === "team" && (
          <View>
            {team.length === 0 ? (
              <Empty message="No team members yet." />
            ) : (
              team.map((m) => (
                <View key={(m.member_id ?? m.email)} style={rowStyle}>
                  <View style={{ flex: 1, paddingRight: space(3) }}>
                    <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.char }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: colors.slate }}>{m.email}</Text>
                  </View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.tangerine }}>
                    {ROLE_LABEL[m.role]}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const rowStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: space(3.5),
  borderBottomWidth: 1,
  borderBottomColor: colors.chalk,
} as const;
