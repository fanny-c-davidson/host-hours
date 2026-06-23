import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import {
  getActiveTimer,
  getProfile,
  getRecentLogs,
  getYearSeconds,
  type LogEntry,
} from "@/lib/db";
import { formatHours, greeting, shortDate } from "@/lib/format";
import { Card, Empty, MetricLabel, ProgressBar, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function DashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [goal, setGoal] = useState(500);
  const [yearSecs, setYearSecs] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!session) return;
        const uid = session.user.id;
        const profile = await getProfile(uid);
        const taxYear = profile?.tax_year ?? new Date().getFullYear();
        const [secs, recent, timer] = await Promise.all([
          getYearSeconds(uid, taxYear),
          getRecentLogs(uid),
          getActiveTimer(uid),
        ]);
        if (!active) return;
        setName(profile?.full_name || session.user.email || "");
        setYear(taxYear);
        setGoal(profile?.goal_hours ?? 500);
        setYearSecs(secs);
        setLogs(recent);
        setTimerRunning(!!timer);
        setLoading(false);
      }
      load();
      return () => {
        active = false;
      };
    }, [session]),
  );

  const hours = yearSecs / 3600;
  const pct = goal > 0 ? (hours / goal) * 100 : 0;
  const firstName = name.split(" ")[0];

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
        <SectionLabel>Host Hours</SectionLabel>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum }}>
          {greeting()}{firstName ? `, ${firstName}` : ""}.
        </Text>

        {/* Year progress */}
        <Card style={{ marginTop: space(6) }}>
          <MetricLabel>{year} hours logged</MetricLabel>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: space(2), marginBottom: space(4) }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 40, color: colors.char }}>{formatHours(yearSecs)}</Text>
            <Text style={{ fontSize: 14, color: colors.slate }}>of {goal} hr goal</Text>
          </View>
          <ProgressBar pct={pct} />
          <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(2) }}>
            {hours >= goal ? "Goal reached 🎉" : `${Math.max(goal - hours, 0).toFixed(0)} hours to go`}
          </Text>
        </Card>

        {/* Quick action */}
        <Pressable
          onPress={() => router.push("/timer")}
          style={{
            marginTop: space(4),
            minHeight: 56,
            borderRadius: radius.md,
            backgroundColor: colors.plum,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: space(2),
          }}
        >
          <Ionicons name={timerRunning ? "stop-circle-outline" : "play-circle-outline"} color={colors.cream} size={20} />
          <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>
            {timerRunning ? "Timer running — open" : "Start a timer"}
          </Text>
        </Pressable>

        {/* Recent activity */}
        <View style={{ marginTop: space(8) }}>
          <SectionLabel>Recent activity</SectionLabel>
          {logs.length === 0 ? (
            <Empty message="No hours logged yet. Start a timer to begin." />
          ) : (
            logs.map((log) => (
              <View
                key={log.id}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: space(3.5),
                  borderBottomWidth: 1,
                  borderBottomColor: colors.chalk,
                }}
              >
                <View style={{ flex: 1, paddingRight: space(3) }}>
                  <Text style={{ fontFamily: fonts.serif, fontSize: 15, color: colors.char }} numberOfLines={1}>
                    {log.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.slate }}>
                    {log.propertyName ?? "—"} · {shortDate(log.started_at)}
                  </Text>
                </View>
                <Text style={{ fontFamily: fonts.mono, fontSize: 13, color: colors.plum }}>
                  {formatHours(log.duration_secs)}h
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
