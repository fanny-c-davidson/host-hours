import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  getAllLogs,
  getCohost,
  getFilterProperties,
  getMyTeamOwner,
  getProfile,
  getTeamMembers,
  isStaff as isStaffRole,
  type FilterProperty,
  type LogEntry,
  type TeamRole,
} from "@/lib/db";
import { getTeamHours } from "@/lib/team-api";
import { roleDisplayName } from "@/lib/permissions";
import { formatDayLabel, formatDuration, formatTime, groupLogs } from "@/lib/format";
import { ActivityRow } from "@/components/activity-group";
import { PropertyFilter } from "@/components/property-filter";
import { API_URL, emailCsvReport } from "@/lib/web-api";
import { colors, fonts, radius, space } from "@/theme/tokens";

// Bar colors for the task/property/member breakdowns (web CATEGORY_COLORS).
const CATEGORY_COLORS = [
  colors.plum,
  colors.tangerine,
  "#0F6E56",
  "#1565C0",
  "#AD1457",
  colors.char,
  colors.slate,
  colors.stone,
];

type Tab = "hours" | "activity" | "team" | "export";

type TeamRow = {
  name: string;
  role: TeamRole;
  display_role: string | null;
  hours: number;
  isYou: boolean;
};

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

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

/** Big serif stat: eyebrow, huge numeral + italic "hours". */
function HeroStat({ eyebrow, value, footer }: { eyebrow: string; value: number; footer?: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: space(7), paddingVertical: space(8), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.slate, fontWeight: "500" }}>
        {eyebrow}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space(2), marginTop: space(2) }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 64, letterSpacing: -3, lineHeight: 68, color: colors.plum, fontVariant: ["tabular-nums"] }}>
          {value.toFixed(1)}
        </Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 24, fontStyle: "italic", color: colors.quill }}>hours</Text>
      </View>
      {footer}
    </View>
  );
}

/** Thin progress bar. */
function Bar({ pct, color, height = 3 }: { pct: number; color: string; height?: number }) {
  return (
    <View style={{ height, borderRadius: radius.pill, backgroundColor: colors.bone, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${Math.min(Math.max(pct, 0), 100)}%`, borderRadius: radius.pill, backgroundColor: color }} />
    </View>
  );
}

/** "15.3 h" serif figure used across breakdown rows. */
function HoursFigure({ hours }: { hours: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2 }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.plum, fontVariant: ["tabular-nums"] }}>{hours.toFixed(1)}</Text>
      <Text style={{ fontFamily: fonts.serif, fontSize: 13, fontStyle: "italic", color: colors.quill }}>h</Text>
    </View>
  );
}

/** Breakdown row: name, colored proportional bar, hours figure. */
function BreakdownRow({ name, pct, hours, color, subline }: { name: string; pct: number; hours: number; color: string; subline?: string | null }) {
  return (
    <View style={{ paddingHorizontal: space(7), paddingVertical: space(4), borderBottomWidth: 1, borderBottomColor: colors.chalk, flexDirection: "row", alignItems: "center", gap: space(3) }}>
      <View style={{ flex: 1, gap: space(2) }}>
        <Text style={{ fontFamily: fonts.serif, fontSize: 15, fontWeight: "500", color: colors.char }}>{name}</Text>
        <Bar pct={pct} color={color} height={2} />
        {subline ? <Text style={{ fontSize: 11, color: colors.slate }}>{subline}</Text> : null}
      </View>
      <HoursFigure hours={hours} />
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={{ paddingHorizontal: space(7), paddingVertical: space(4), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.char }}>{children}</Text>
    </View>
  );
}

function EmptyState({ title, body, primary, secondary }: {
  title: string;
  body: string;
  primary?: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ paddingHorizontal: space(7), paddingVertical: space(16), alignItems: "center" }}>
      <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.plum, marginBottom: space(2) }}>{title}</Text>
      <Text style={{ fontSize: 13, color: colors.quill, lineHeight: 19, textAlign: "center", maxWidth: 280, marginBottom: space(8) }}>{body}</Text>
      <View style={{ gap: space(3), width: 240 }}>
        {primary && (
          <Pressable onPress={primary.onPress} style={{ minHeight: 48, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>{primary.label}</Text>
          </Pressable>
        )}
        {secondary && (
          <Pressable onPress={secondary.onPress} style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.chalk, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.quill, fontSize: 15, fontWeight: "500" }}>{secondary.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ReportsScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("hours");
  const [role, setRole] = useState<TeamRole>("owner");
  const [userName, setUserName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [goal, setGoal] = useState(500);
  const [target, setTarget] = useState<string>("500");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [properties, setProperties] = useState<FilterProperty[]>([]);
  const [activeProp, setActiveProp] = useState("All properties");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [cohostName, setCohostName] = useState<string | null>(null);
  const [cohostLogs, setCohostLogs] = useState<LogEntry[]>([]);
  const [showCombined, setShowCombined] = useState(false);
  const [team, setTeam] = useState<TeamRow[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [pdfYear, setPdfYear] = useState(new Date().getFullYear());

  const refreshLogs = useCallback(async () => {
    if (!uid) return;
    setLogs(await getAllLogs(uid));
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function load() {
        if (!uid) return;
        // Team rows live under the owner's id — a spouse querying with their
        // own uid would always see an empty team.
        const { ownerId, role: r } = await getMyTeamOwner(uid);
        const [profile, allLogs, props, cohost] = await Promise.all([
          getProfile(uid),
          getAllLogs(uid),
          getFilterProperties(),
          getCohost(uid),
        ]);
        if (!active) return;
        setRole(r);
        setUserName(profile?.full_name?.split(" ")[0] ?? "You");
        setYear(profile?.tax_year ?? new Date().getFullYear());
        const staff = isStaffRole(r);
        const loadedGoal = profile?.goal_hours ?? 500;
        // Helpers/managers have no target test; their goal defaults to 100.
        setGoal(staff && loadedGoal === 500 ? 100 : loadedGoal);
        setTarget(profile?.target_test ?? "500");
        setLogs(allLogs);
        setProperties(props);
        setCohostName(cohost?.name ?? null);

        // Cohost logs (RLS lets spouses read each other's entries, like web).
        const cohostAll = cohost ? await getAllLogs(cohost.memberId) : [];
        if (!active) return;
        setCohostLogs(cohostAll);

        // Team tab. RLS lets us compute our own + the cohost's hours directly;
        // helpers'/managers' hours need the web bridge (service role) and fill
        // in when it responds — the screen never blocks on that network call.
        if (!staff) {
          const members = await getTeamMembers(ownerId);
          if (!active) return;
          // The owner's real first name (web shows "Fanny", not "Owner").
          let ownerName = profile?.full_name?.split(" ")[0] || "You";
          if (ownerId !== uid) {
            const ownerProfile = await getProfile(ownerId).catch(() => null);
            ownerName = ownerProfile?.full_name?.split(" ")[0] || cohost?.name || "Owner";
          }
          const totalSecs = (l: LogEntry[]) => l.reduce((s, e) => s + e.duration_secs, 0);
          const localSeconds: Record<string, number> = { [uid]: totalSecs(allLogs) };
          if (cohost) localSeconds[cohost.memberId] = totalSecs(cohostAll);

          const buildTeam = (seconds: Record<string, number>): TeamRow[] => {
            const hoursFor = (id: string | null) => (id ? (seconds[id] ?? 0) / 3600 : 0);
            return [
              {
                name: ownerName,
                role: "owner" as TeamRole,
                display_role: null,
                hours: hoursFor(ownerId),
                isYou: ownerId === uid,
              },
              ...members
                .filter((m) => m.member_id !== ownerId)
                .map((m) => ({
                  name: m.name,
                  role: m.role,
                  display_role: m.display_role,
                  hours: hoursFor(m.member_id),
                  isYou: m.member_id === uid,
                })),
            ];
          };
          setTeam(members.length > 0 ? buildTeam(localSeconds) : []);
          if (members.length > 0) {
            getTeamHours(ownerId)
              .then((res) => {
                // Bridge values win where present (covers staff members too).
                if (active && res.data) setTeam(buildTeam({ ...localSeconds, ...res.data }));
              })
              .catch(() => {}); // bridge offline — staff rows stay at 0h
          }
        }
        setLoading(false);
      }
      load().catch(() => setLoading(false));
      return () => {
        active = false;
      };
    }, [uid]),
  );

  const staff = isStaffRole(role);
  const allTags = Array.from(new Set(properties.flatMap((p) => p.tags))).sort();

  const filtered = activeProp === "All properties" ? logs : logs.filter((e) => e.propertyName === activeProp);
  const filteredHours = filtered.reduce((s, e) => s + e.duration_secs, 0) / 3600;
  const cohostHours = cohostLogs.reduce((s, e) => s + e.duration_secs, 0) / 3600;
  const irsHours = showCombined ? filteredHours + cohostHours : filteredHours;
  const combinedTotal = showCombined ? filteredHours + cohostHours : filteredHours;

  // Category + property breakdowns (mirror web's maps, cohost included when combined)
  const catMap = new Map<string, number>();
  for (const e of filtered) catMap.set(e.title || "Untitled", (catMap.get(e.title || "Untitled") ?? 0) + e.duration_secs / 3600);
  if (showCombined) for (const e of cohostLogs) catMap.set(e.title || "Untitled", (catMap.get(e.title || "Untitled") ?? 0) + e.duration_secs / 3600);
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([name, hours]) => ({ name, hours, pct: combinedTotal > 0 ? (hours / combinedTotal) * 100 : 0 }))
    .sort((a, b) => b.hours - a.hours);

  const propMap = new Map<string, number>();
  for (const e of filtered) propMap.set(e.propertyName ?? "Unknown", (propMap.get(e.propertyName ?? "Unknown") ?? 0) + e.duration_secs / 3600);
  if (showCombined) for (const e of cohostLogs) propMap.set(e.propertyName ?? "Unknown", (propMap.get(e.propertyName ?? "Unknown") ?? 0) + e.duration_secs / 3600);
  const propertyBreakdown = Array.from(propMap.entries())
    .map(([name, hours]) => ({ name, hours, pct: combinedTotal > 0 ? (hours / combinedTotal) * 100 : 0 }))
    .sort((a, b) => b.hours - a.hours);

  // KPI sections (web `kpis` array)
  const targetHours = target === "substantially" ? null : parseInt(target, 10);
  const kpis = [
    {
      name: "Annual Goal",
      reached: irsHours >= goal,
      status: irsHours >= goal ? "Goal reached" : "In progress",
      detail: `${irsHours.toFixed(1)} of ${goal} hours logged${showCombined ? " (combined)" : ""}`,
      barPct: goal > 0 ? (irsHours / goal) * 100 : 0,
      coach: irsHours >= goal
        ? `You've reached your ${goal}-hour goal.`
        : `${Math.max(goal - irsHours, 0).toFixed(0)} more hours to reach your goal.`,
    },
    ...(staff
      ? []
      : targetHours
        ? [{
            name: "Target Test",
            reached: irsHours >= targetHours,
            status: irsHours >= targetHours ? "Goal reached" : "In progress",
            detail: `${irsHours.toFixed(1)} of ${targetHours} hours logged${showCombined ? " (combined)" : ""}`,
            barPct: (irsHours / targetHours) * 100,
            coach: irsHours >= targetHours
              ? `You've logged ${targetHours}+ hours. Consult your tax advisor to confirm eligibility.`
              : `${Math.max(targetHours - irsHours, 0).toFixed(0)} more hours to reach this benchmark.`,
          }]
        : [{
            name: "Target Test",
            reached: false,
            status: "Substantially all",
            detail: `${irsHours.toFixed(1)} hours logged${showCombined ? " (combined)" : ""}`,
            barPct: 100,
            coach: "Your target is substantially all participation. Consult your tax advisor.",
          }]),
  ];

  const activityGroups = groupLogs(
    filtered.map((e) => ({
      id: e.id,
      title: e.title,
      started_at: e.started_at,
      ended_at: e.ended_at,
      duration_secs: e.duration_secs,
      description: e.description,
      is_onsite: e.is_onsite,
      property_id: e.property_id,
      propertyName: e.propertyName,
    })),
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: "hours", label: "My Hours" },
    { key: "activity", label: "Activity" },
    ...(staff ? [] : [
      { key: "team" as Tab, label: "Team" },
      { key: "export" as Tab, label: "Reports" },
    ]),
  ];
  const title = tab === "hours" ? "My Hours" : tab === "activity" ? "Activity" : tab === "team" ? "Team" : "Reports";

  const filterProps = {
    properties,
    allTags,
    activeTag,
    activeProp,
    onTagChange: (tag: string | null) => {
      setActiveTag(tag);
      setActiveProp("All properties");
    },
    onPropChange: setActiveProp,
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  const hasData = logs.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      {/* Header */}
      <View style={{ paddingHorizontal: space(7), paddingTop: space(4), paddingBottom: space(4), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine, fontWeight: "500", marginBottom: space(1) }}>
          Reports
        </Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum }}>{title}</Text>
      </View>

      {/* Tabs */}
      <View style={{ paddingHorizontal: space(7), flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={{ paddingVertical: space(3), marginRight: space(6), borderBottomWidth: 2, marginBottom: -1, borderBottomColor: tab === t.key ? colors.plum : "transparent" }}>
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: "500", color: tab === t.key ? colors.plum : colors.quill }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: space(12) }}>
        {/* ── My Hours tab ─────────────────────────────────────── */}
        {tab === "hours" && (
          hasData ? (
            <>
              <PropertyFilter
                {...filterProps}
                cohostName={cohostName}
                showCombined={showCombined}
                onToggleCombined={cohostName ? () => setShowCombined(!showCombined) : undefined}
              />

              <HeroStat
                eyebrow={`${showCombined ? "Combined total" : "Your total"} · ${year}`}
                value={combinedTotal}
                footer={
                  showCombined ? (
                    <View style={{ marginTop: space(4), gap: space(1) }}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: colors.quill }}>You</Text>
                        <Text style={{ fontSize: 13, color: colors.char, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{filteredHours.toFixed(1)}h</Text>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 13, color: colors.quill }}>{cohostName ?? "Spouse Co-Owner"}</Text>
                        <Text style={{ fontSize: 13, color: colors.char, fontWeight: "500", fontVariant: ["tabular-nums"] }}>{cohostHours.toFixed(1)}h</Text>
                      </View>
                    </View>
                  ) : undefined
                }
              />

              {/* KPIs */}
              {kpis.map((k) => (
                <View key={k.name} style={{ paddingHorizontal: space(7), paddingVertical: space(5), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space(2) }}>
                    <Text style={{ fontFamily: fonts.serif, fontSize: 18, fontWeight: "500", color: colors.char }}>{k.name}</Text>
                    <View style={{ paddingHorizontal: space(2.5), paddingVertical: space(1), borderRadius: radius.pill, backgroundColor: k.reached ? colors.successBg : colors.tangerineGlow }}>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", fontWeight: "500", color: k.reached ? colors.success : colors.tangerine }}>
                        {k.status}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: colors.slate, marginBottom: space(3) }}>{k.detail}</Text>
                  <Bar pct={k.barPct} color={k.reached ? colors.success : colors.plum} />
                  <Text style={{ fontSize: 12, lineHeight: 18, color: k.reached ? colors.success : colors.slate, marginTop: space(3) }}>{k.coach}</Text>
                </View>
              ))}

              {/* By task type */}
              {categoryBreakdown.length > 0 && (
                <>
                  <SectionTitle>By task type</SectionTitle>
                  {categoryBreakdown.map((c, i) => (
                    <BreakdownRow key={c.name} name={c.name} pct={c.pct} hours={c.hours} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                  ))}
                </>
              )}

              {/* By property */}
              {propertyBreakdown.length > 0 && (
                <>
                  <SectionTitle>By property</SectionTitle>
                  {propertyBreakdown.map((p, i) => (
                    <BreakdownRow key={p.name} name={p.name} pct={p.pct} hours={p.hours} color={CATEGORY_COLORS[(i + 3) % CATEGORY_COLORS.length]} />
                  ))}
                </>
              )}
            </>
          ) : (
            <EmptyState
              title="No data yet"
              body="Once you start logging hours, your progress benchmarks and category breakdown will appear here."
              primary={{ label: "Start tracking", onPress: () => router.push("/timer") }}
              secondary={{ label: "Set your tax goal", onPress: () => router.push("/settings-tax") }}
            />
          )
        )}

        {/* ── Activity tab ─────────────────────────────────────── */}
        {tab === "activity" && (
          hasData ? (
            <>
              <PropertyFilter {...filterProps} />

              {/* Summary */}
              <View style={{ paddingHorizontal: space(7), paddingVertical: space(5), borderBottomWidth: 1, borderBottomColor: colors.chalk, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, color: colors.slate }}>
                  {filtered.length} entries · {filteredHours.toFixed(1)} hours
                </Text>
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill }}>
                  Most recent first
                </Text>
              </View>

              {/* Grouped list — same expandable editor as the dashboard */}
              <View style={{ paddingHorizontal: space(7) }}>
                {activityGroups.map((g) => (
                  <ActivityRow
                    key={g.key}
                    group={g}
                    expanded={expandedKey === g.key}
                    onToggle={() => setExpandedKey(expandedKey === g.key ? null : g.key)}
                    onUpdated={refreshLogs}
                  />
                ))}
              </View>
            </>
          ) : (
            <EmptyState
              title="No activity yet"
              body="Start a timer or log hours manually. Your entries will appear here."
              primary={{ label: "Start timer", onPress: () => router.push("/timer") }}
              secondary={{ label: "Log hours manually", onPress: () => router.push("/log") }}
            />
          )
        )}

        {/* ── Team tab ─────────────────────────────────────────── */}
        {tab === "team" && (
          team.length > 0 ? (
            <>
              <HeroStat
                eyebrow={`Team total · ${new Date().getFullYear()}`}
                value={team.reduce((s, m) => s + m.hours, 0)}
                footer={
                  <Text style={{ fontSize: 13, color: colors.slate, marginTop: space(3) }}>
                    {team.length} {team.length === 1 ? "person" : "people"}
                  </Text>
                }
              />
              {(() => {
                const maxHours = Math.max(...team.map((m) => m.hours), 1);
                return [...team]
                  .sort((a, b) => b.hours - a.hours)
                  .map((m, i) => (
                    <View key={m.name + m.role} style={{ paddingHorizontal: space(7), paddingVertical: space(4), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space(2) }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flex: 1, paddingRight: space(3) }}>
                          <Text style={{ fontFamily: fonts.serif, fontSize: 15, fontWeight: "500", color: colors.char }} numberOfLines={1}>
                            {m.name}{m.isYou ? " (you)" : ""}
                          </Text>
                          <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.vellum }}>
                            <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", fontWeight: "500", color: colors.quill }}>
                              {roleDisplayName(m.role, m.display_role)}
                            </Text>
                          </View>
                        </View>
                        <HoursFigure hours={m.hours} />
                      </View>
                      <Bar pct={(m.hours / maxHours) * 100} color={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                    </View>
                  ));
              })()}
            </>
          ) : (
            <EmptyState
              title="No team members yet"
              body="Invite your spouse, managers, or helpers to track hours together."
              primary={{ label: "Manage team", onPress: () => router.push("/settings-team") }}
            />
          )
        )}

        {/* ── Reports (export) tab — mirrors web layout ───────── */}
        {tab === "export" && (
          hasData ? (
            <>
              <PropertyFilter
                {...filterProps}
                cohostName={cohostName}
                showCombined={showCombined}
                onToggleCombined={cohostName ? () => setShowCombined(!showCombined) : undefined}
              />

              <View style={{ paddingHorizontal: space(7), paddingVertical: space(7), gap: space(4) }}>
                {/* Tax year pills */}
                <View>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginBottom: space(2) }}>
                    Tax year
                  </Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
                    {(() => {
                      const years = Array.from(
                        new Set([
                          ...logs.map((e) => new Date(e.started_at).getFullYear()),
                          ...(showCombined ? cohostLogs.map((e) => new Date(e.started_at).getFullYear()) : []),
                        ]),
                      ).sort((a, b) => b - a);
                      if (years.length === 0) years.push(new Date().getFullYear());
                      return years.map((yr) => (
                        <Pressable
                          key={yr}
                          onPress={() => setPdfYear(yr)}
                          style={{
                            paddingHorizontal: space(4),
                            paddingVertical: space(2),
                            borderRadius: radius.pill,
                            borderWidth: 1,
                            borderColor: pdfYear === yr ? colors.plum : colors.chalk,
                            backgroundColor: pdfYear === yr ? colors.plum : colors.cream,
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "500", color: pdfYear === yr ? colors.cream : colors.quill }}>
                            {yr}
                          </Text>
                        </Pressable>
                      ));
                    })()}
                  </View>
                </View>

                {/* Download tax PDF — generated on the web, opens there */}
                <View>
                  <Pressable
                    onPress={() => Linking.openURL(`${API_URL}/reports?tab=export`)}
                    style={{ minHeight: 48, borderRadius: radius.md, backgroundColor: colors.plum, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space(2) }}
                  >
                    <Ionicons name="download-outline" size={16} color={colors.cream} />
                    <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.cream, fontWeight: "500" }}>
                      Download {pdfYear} Tax Report PDF
                    </Text>
                  </Pressable>
                  <Text style={{ fontSize: 11, color: colors.slate, textAlign: "center", marginTop: space(2) }}>
                    Opens the web app, where the PDF (with receipt thumbnails) is generated.
                  </Text>
                </View>

                {/* All activities CSV */}
                <View style={{ borderTopWidth: 1, borderTopColor: colors.chalk, paddingTop: space(4) }}>
                  <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginBottom: space(2) }}>
                    All activities
                  </Text>
                  <Pressable
                    onPress={async () => {
                      const email = session?.user.email;
                      if (!email) return;
                      setEmailing(true);
                      setEmailStatus(null);
                      const { error } = await emailCsvReport(logsToCsv(filtered), email, activeProp);
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
                    <Text style={{ fontSize: 12, color: emailStatus.startsWith("Report sent") ? colors.success : colors.tangerine, textAlign: "center", marginTop: space(2) }}>
                      {emailStatus}
                    </Text>
                  )}
                </View>
              </View>
            </>
          ) : (
            <EmptyState
              title="No data yet"
              body="Start logging hours to generate tax reports and export your data."
              primary={{ label: "Start tracking", onPress: () => router.push("/timer") }}
            />
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
