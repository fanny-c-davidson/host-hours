import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import {
  getActiveTimer,
  getProfile,
  getProperties,
  getRecentLogs,
  getTaskTypes,
  startTimer,
  stopTimer,
  updateTimeLog,
  type ActiveTimer,
  type LogEntry,
  type Property,
  type TaskType,
} from "@/lib/db";
import {
  formatDayLabel,
  formatDuration,
  formatElapsed,
  formatTime,
  greeting,
  groupLogs,
  mastheadDate,
  type LogGroup,
} from "@/lib/format";
import { ReceiptAttach } from "@/components/receipt-attach";
import { colors, fonts, radius, space } from "@/theme/tokens";

// ---------------------------------------------------------------------------
// Pulsing dot component for active timer
// ---------------------------------------------------------------------------
function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.tangerine,
        opacity,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Elapsed clock hook
// ---------------------------------------------------------------------------
function useElapsedSeconds(startedAt: string | null): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }
    const start = new Date(startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsed;
}

// ---------------------------------------------------------------------------
// Section header component
// ---------------------------------------------------------------------------
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: fonts.mono,
        fontSize: 10,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: colors.slate,
        marginBottom: space(3),
      }}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// User initials avatar
// ---------------------------------------------------------------------------
function UserAvatar({ name, onPress }: { name: string; onPress: () => void }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.plum,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 16,
            color: colors.cream,
          }}
        >
          {initials || "?"}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Task pill
// ---------------------------------------------------------------------------
function TaskPill({
  label,
  onPress,
}: {
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View
        style={{
          paddingHorizontal: space(4),
          paddingVertical: space(2),
          borderRadius: radius.pill,
          backgroundColor: "rgba(251, 248, 241, 0.15)",
          borderWidth: 1,
          borderColor: "rgba(251, 248, 241, 0.2)",
        }}
      >
        <Text
          style={{
            fontSize: 13,
            fontWeight: "500",
            color: colors.cream,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Active timer card
// ---------------------------------------------------------------------------
function ActiveTimerCard({
  timer,
  propertyName,
  onStop,
}: {
  timer: ActiveTimer;
  propertyName: string;
  onStop: () => void;
}) {
  const elapsed = useElapsedSeconds(timer.started_at);
  const router = useRouter();

  return (
    <View
      style={{
        backgroundColor: colors.plum,
        borderRadius: 12,
        padding: space(5),
        marginBottom: space(4),
      }}
    >
      {/* "You are at" label */}
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "rgba(251, 248, 241, 0.6)",
          fontWeight: "500",
        }}
      >
        You are at
      </Text>

      {/* Property name + elapsed on same row */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: space(3),
          marginTop: space(1),
        }}
      >
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 22,
            color: colors.cream,
            fontWeight: "500",
            flex: 1,
          }}
          numberOfLines={1}
        >
          {propertyName}
        </Text>
        <Text
          style={{
            fontFamily: fonts.serif,
            fontSize: 24,
            color: colors.tangerine,
          }}
        >
          {formatElapsed(elapsed)}
        </Text>
      </View>

      {/* Task pill with pulsing dot + tangerine border */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: space(3),
          marginBottom: space(4),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space(2),
            paddingHorizontal: space(3),
            paddingVertical: space(1.5),
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: "rgba(255, 107, 53, 0.5)",
          }}
        >
          <PulsingDot />
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: colors.tangerine,
              fontWeight: "500",
            }}
          >
            {timer.title}
          </Text>
        </View>
      </View>

      {/* Stop button + Add details */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space(4),
        }}
      >
        <Pressable
          onPress={onStop}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space(2),
            minHeight: 44,
            paddingHorizontal: space(5),
            paddingVertical: space(2),
            borderRadius: radius.pill,
            backgroundColor: colors.cream,
          }}
        >
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: colors.plum,
            }}
          />
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: colors.plum,
              fontWeight: "500",
            }}
          >
            Stop
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/timer")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 10,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: "rgba(251, 248, 241, 0.8)",
              textDecorationLine: "underline",
              textDecorationColor: colors.tangerine,
            }}
          >
            Add details {"→"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Property card (Your Properties section)
// ---------------------------------------------------------------------------
function PropertyCard({
  property,
  taskTypes,
  onStartTimer,
}: {
  property: Property;
  taskTypes: TaskType[];
  onStartTimer: (propertyId: string, taskName: string) => void;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.plum,
        borderRadius: radius.md,
        padding: space(5),
        marginBottom: space(3),
      }}
    >
      {/* "You are at" label */}
      <Text
        style={{
          fontFamily: fonts.mono,
          fontSize: 10,
          letterSpacing: 1.5,
          textTransform: "uppercase",
          color: "rgba(251, 248, 241, 0.6)",
          fontWeight: "500",
        }}
      >
        You are at
      </Text>

      {/* Property name */}
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: 22,
          color: colors.cream,
          fontWeight: "500",
          marginTop: space(1),
          marginBottom: space(4),
        }}
        numberOfLines={1}
      >
        {property.name}
      </Text>

      {/* "Start a task" header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space(2),
          marginBottom: space(3),
        }}
      >
        <Ionicons name="time-outline" size={16} color="rgba(251,248,241,0.7)" />
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: 10,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            color: "rgba(251, 248, 241, 0.6)",
            fontWeight: "500",
          }}
        >
          Start a task
        </Text>
      </View>

      {/* Task type pills */}
      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space(2),
        }}
      >
        {taskTypes.map((t) => (
          <TaskPill
            key={t.id}
            label={t.name}
            onPress={() => onStartTimer(property.id, t.name)}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Recent property row
// ---------------------------------------------------------------------------
function PropertyRow({
  property,
  onStart,
  onLog,
}: {
  property: Property;
  onStart: () => void;
  onLog: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: space(3),
        borderBottomWidth: 1,
        borderBottomColor: colors.chalk,
      }}
    >
      {/* Color dot */}
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: property.color || colors.plum,
          marginRight: space(3),
        }}
      />

      {/* Name */}
      <Text
        style={{
          flex: 1,
          fontFamily: fonts.serif,
          fontSize: 15,
          color: colors.char,
        }}
        numberOfLines={1}
      >
        {property.name}
      </Text>

      {/* Actions */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
        <Pressable onPress={onStart}>
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: colors.plum,
            }}
          >
            Start timer
          </Text>
        </Pressable>
        <Text style={{ color: colors.chalk, fontSize: 10 }}>|</Text>
        <Pressable onPress={onLog}>
          <Text
            style={{
              fontFamily: fonts.mono,
              fontSize: 9,
              letterSpacing: 1,
              textTransform: "uppercase",
              color: colors.plum,
            }}
          >
            Log hours
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Activity row (grouped by task + property + day)
// ---------------------------------------------------------------------------
function localDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function displayAmPm(hhmm: string): string {
  if (!hhmm.includes(":")) return "--:-- --";
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function parseTimeInput(text: string): string | null {
  const c = text.trim().toUpperCase();
  const m12 = c.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    if (h < 1 || h > 12 || m > 59) return null;
    if (m12[3] === "AM" && h === 12) h = 0;
    else if (m12[3] === "PM" && h !== 12) h += 12;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const m24 = c.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return null;
}

function TimeRangeBar({ entry, onSave }: { entry: LogGroup["entries"][0]; onSave: (id: string, fields: any) => void }) {
  const [startT, setStartT] = useState(() => {
    const s = toHHMM(entry.started_at), e = toHHMM(entry.ended_at);
    return s <= e ? s : e;
  });
  const [endT, setEndT] = useState(() => {
    const s = toHHMM(entry.started_at), e = toHHMM(entry.ended_at);
    return s <= e ? e : s;
  });
  const [editField, setEditField] = useState<"start" | "end" | null>(null);
  const [buf, setBuf] = useState("");
  const committed = useRef(false);

  useEffect(() => {
    let s = toHHMM(entry.started_at);
    let e = toHHMM(entry.ended_at);
    if (s > e) { const tmp = s; s = e; e = tmp; }
    setStartT(s);
    setEndT(e);
  }, [entry.started_at, entry.ended_at]);

  function commit(field: "start" | "end", raw: string) {
    if (committed.current) return;
    committed.current = true;
    const hhmm = parseTimeInput(raw);
    if (!hhmm) { setEditField(null); return; }
    const dateStr = localDateStr(entry.started_at);
    const st = field === "start" ? hhmm : startT;
    const en = field === "end" ? hhmm : endT;
    setStartT(st);
    setEndT(en);
    const newStart = new Date(`${dateStr}T${st}:00`);
    let newEnd = new Date(`${dateStr}T${en}:00`);
    // An end before the start means the session ran past midnight — roll the
    // end to the next day (matches the web editor) instead of swapping fields.
    if (newEnd.getTime() < newStart.getTime()) {
      newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    setEditField(null);
    onSave(entry.id, { started_at: newStart.toISOString(), ended_at: newEnd.toISOString() });
  }

  function startEdit(field: "start" | "end") {
    committed.current = false;
    setBuf(displayAmPm(field === "start" ? startT : endT));
    setEditField(field);
  }

  return (
    <View style={{ marginBottom: space(3), marginHorizontal: 6 }}>
      <View style={{ height: 3, backgroundColor: "rgba(74,20,140,0.15)", borderRadius: radius.pill }}>
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(74,20,140,0.7)", borderRadius: radius.pill }} />
        <View style={{ position: "absolute", top: "50%", left: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.plum, borderWidth: 2, borderColor: colors.cream, transform: [{ translateX: -5 }, { translateY: -5 }] }} />
        <View style={{ position: "absolute", top: "50%", right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.plum, borderWidth: 2, borderColor: colors.cream, transform: [{ translateX: 5 }, { translateY: -5 }] }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: space(2.5) }}>
        {editField === "start" ? (
          <TextInput autoFocus value={buf} onChangeText={setBuf}
            onBlur={() => commit("start", buf)}
            onSubmitEditing={() => commit("start", buf)}
            placeholder="1:30 PM" placeholderTextColor={colors.stone}
            style={{ minWidth: 100, paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.plum, borderRadius: radius.md, fontSize: 13, color: colors.char, backgroundColor: colors.cream }} />
        ) : (
          <Pressable onPress={() => startEdit("start")}
            style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md }}>
            <Text style={{ fontSize: 13, color: colors.char }}>{displayAmPm(startT)}</Text>
            <Ionicons name="time-outline" size={14} color={colors.plum} />
          </Pressable>
        )}
        {editField === "end" ? (
          <TextInput autoFocus value={buf} onChangeText={setBuf}
            onBlur={() => commit("end", buf)}
            onSubmitEditing={() => commit("end", buf)}
            placeholder="2:30 PM" placeholderTextColor={colors.stone}
            style={{ minWidth: 100, paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.plum, borderRadius: radius.md, fontSize: 13, color: colors.char, backgroundColor: colors.cream }} />
        ) : (
          <Pressable onPress={() => startEdit("end")}
            style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), paddingHorizontal: space(2.5), paddingVertical: space(1.5), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md }}>
            <Text style={{ fontSize: 13, color: colors.char }}>{displayAmPm(endT)}</Text>
            <Ionicons name="time-outline" size={14} color={colors.plum} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ActivityRow({
  group,
  expanded,
  onToggle,
  onUpdated,
}: {
  group: LogGroup;
  expanded: boolean;
  onToggle: () => void;
  onUpdated: () => void;
}) {
  const rep = group.entries[0];
  const ids = group.entries.map((e) => e.id);
  const [notes, setNotes] = useState(group.description ?? "");
  const [isOnsite, setIsOnsite] = useState(group.isOnsite);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  async function runSave(fn: () => Promise<any>) {
    setSaveStatus("saving");
    await fn();
    setSaveStatus("saved");
    onUpdated();
    setTimeout(() => setSaveStatus((s) => (s === "saved" ? null : s) as any), 1500);
  }

  function handleTimeChange(entryId: string, fields: { started_at: string; ended_at: string }) {
    runSave(() => updateTimeLog(entryId, fields));
  }

  function handleNotesChange(text: string) {
    setNotes(text);
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      runSave(async () => {
        for (const id of ids) await updateTimeLog(id, { description: text.trim() || null });
      });
    }, 800);
  }

  function handleOnsiteToggle(onsite: boolean) {
    setIsOnsite(onsite);
    runSave(async () => {
      for (const id of ids) await updateTimeLog(id, { is_onsite: onsite });
    });
  }

  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
      <Pressable onPress={onToggle} style={{ flexDirection: "row", alignItems: "center", paddingVertical: space(4.5) }}>
        <View style={{ width: 72 }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 12, fontWeight: "700", color: colors.char, lineHeight: 16 }}>
            {formatDayLabel(rep.started_at)}
          </Text>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.slate, lineHeight: 16 }}>
            {formatTime(rep.started_at)}
          </Text>
        </View>
        <View style={{ flex: 1, paddingHorizontal: space(3) }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 15, fontWeight: "500", color: colors.char, lineHeight: 20 }} numberOfLines={1}>
            {group.title}
          </Text>
          <Text style={{ fontSize: 12, color: colors.quill, lineHeight: 16 }} numberOfLines={1}>
            {group.propertyName ?? "—"}
            {group.entries.length > 1 ? ` · ${group.entries.length} sessions` : ""}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2.5) }}>
          <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.plum }}>
            {formatDuration(group.totalSecs)}
          </Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.tangerine} />
        </View>
      </Pressable>

      {expanded && (
        <View style={{ paddingBottom: space(4) }}>
          <View style={{ alignItems: "flex-end", height: 16, marginBottom: space(1) }}>
            {saveStatus === "saving" && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={colors.slate} />
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.slate }}>Saving</Text>
              </View>
            )}
            {saveStatus === "saved" && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.success }}>✓ Saved</Text>
            )}
          </View>

          {group.entries.map((entry) => (
            <TimeRangeBar key={entry.id} entry={entry} onSave={handleTimeChange} />
          ))}

          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginTop: space(2), marginBottom: space(2) }}>Location</Text>
          <View style={{ flexDirection: "row", gap: space(2) }}>
            <Pressable onPress={() => handleOnsiteToggle(true)} style={{ flex: 1, paddingVertical: space(2.5), borderRadius: radius.md, borderWidth: 1, borderColor: isOnsite ? colors.plum : colors.chalk, backgroundColor: isOnsite ? colors.plum : colors.cream, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: isOnsite ? colors.cream : colors.quill, fontWeight: "500" }}>On-site</Text>
            </Pressable>
            <Pressable onPress={() => handleOnsiteToggle(false)} style={{ flex: 1, paddingVertical: space(2.5), borderRadius: radius.md, borderWidth: 1, borderColor: !isOnsite ? colors.plum : colors.chalk, backgroundColor: !isOnsite ? colors.plum : colors.cream, alignItems: "center" }}>
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: !isOnsite ? colors.cream : colors.quill, fontWeight: "500" }}>Remote</Text>
            </Pressable>
          </View>

          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginTop: space(4), marginBottom: space(2) }}>Notes</Text>
          <TextInput value={notes} onChangeText={handleNotesChange} placeholder="What did you work on?" placeholderTextColor={colors.stone} multiline
            style={{ minHeight: 60, paddingHorizontal: space(4), paddingVertical: space(3), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md, fontSize: 14, color: colors.char, backgroundColor: colors.cream, textAlignVertical: "top" }} />

          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, fontWeight: "500", marginTop: space(4), marginBottom: space(2) }}>Receipts or photos</Text>
          <ReceiptAttach timeLogIds={ids} />
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Onboarding
// ---------------------------------------------------------------------------
function Onboarding() {
  const router = useRouter();

  return (
    <View
      style={{
        backgroundColor: colors.plum,
        borderRadius: radius.md,
        padding: space(6),
        alignItems: "center",
      }}
    >
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: 22,
          color: colors.cream,
          textAlign: "center",
          marginBottom: space(2),
        }}
      >
        Welcome to Host Hours
      </Text>
      <Text
        style={{
          fontFamily: fonts.serifRegular,
          fontSize: 14,
          color: "rgba(251, 248, 241, 0.7)",
          textAlign: "center",
          marginBottom: space(5),
          lineHeight: 20,
        }}
      >
        Add your first short-term rental property to start tracking hours for IRS
        material participation tests.
      </Text>
      <Pressable
        onPress={() => router.push("/property-new")}
        style={{
          backgroundColor: colors.cream,
          paddingHorizontal: space(6),
          paddingVertical: space(3),
          borderRadius: radius.pill,
        }}
      >
        <Text
          style={{
            fontFamily: fonts.mono,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: "uppercase",
            color: colors.plum,
          }}
        >
          Add property
        </Text>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dashboard screen
// ---------------------------------------------------------------------------
export default function DashboardScreen() {
  const { session } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [activePropertyName, setActivePropertyName] = useState("");
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;

    const [profile, props, tasks, recent, timer] = await Promise.all([
      getProfile(uid),
      getProperties(),
      getTaskTypes(),
      getRecentLogs(uid, 10),
      getActiveTimer(uid),
    ]);

    setName(profile?.full_name || session.user.email || "");
    setProperties(props);
    setTaskTypes(tasks);
    setLogs(recent);
    setActiveTimer(timer);

    // Resolve active timer's property name
    if (timer) {
      const prop = props.find((p) => p.id === timer.property_id);
      setActivePropertyName(prop?.name ?? "Unknown");
    }

    setLoading(false);
  }, [session]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadData().then(() => {
        if (!active) return;
      });
      return () => {
        active = false;
      };
    }, [loadData]),
  );

  // -- Handlers --

  const handleStopTimer = useCallback(async () => {
    if (!activeTimer || !session) return;
    const { data } = await stopTimer(activeTimer.id, session.user.id);
    setActiveTimer(null);
    if (data) {
      router.push(`/timer?stopped=${data.id}`);
    } else {
      router.push(`/timer?property=${activeTimer.property_id}`);
    }
  }, [activeTimer, session, router]);

  const handleStartTimer = useCallback(
    async (propertyId: string, taskName: string) => {
      if (!session) return;
      const { data } = await startTimer(session.user.id, propertyId, taskName);
      if (data) {
        setActiveTimer(data);
        const prop = properties.find((p) => p.id === propertyId);
        setActivePropertyName(prop?.name ?? "Unknown");
      }
    },
    [session, properties],
  );

  // -- Derived --

  const firstName = name.split(" ")[0];

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.cream,
        }}
      >
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{
          padding: space(7),
          paddingBottom: space(12),
        }}
      >
        {/* ── Masthead ─────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: space(6),
          }}
        >
          <View style={{ flex: 1, marginRight: space(4) }}>
            {/* Date line */}
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: colors.slate,
                marginBottom: space(2),
              }}
            >
              {mastheadDate()}
            </Text>

            {/* Greeting */}
            <Text
              style={{
                fontFamily: fonts.serif,
                fontSize: 18,
                color: colors.char,
                fontWeight: "500",
                lineHeight: 24,
              }}
            >
              {greeting()}{firstName ? `, ${firstName}` : ""}
            </Text>
          </View>

          {/* User avatar */}
          <UserAvatar
            name={name}
            onPress={() => router.push("/settings")}
          />
        </View>

        {/* ── Active timer card ──────────────────────── */}
        {activeTimer && (
          <ActiveTimerCard
            timer={activeTimer}
            propertyName={activePropertyName}
            onStop={handleStopTimer}
          />
        )}

        {/* ── Onboarding (no properties) ─────────────── */}
        {properties.length === 0 && !activeTimer && <Onboarding />}

        {/* ── Featured property card (first/most recent) ── */}
        {properties.length > 0 && !activeTimer && (
          <View style={{ marginBottom: space(2) }}>
            <PropertyCard
              property={properties[0]}
              taskTypes={taskTypes}
              onStartTimer={handleStartTimer}
            />
          </View>
        )}

        {/* ── Recent Properties list (remaining) ─────── */}
        {properties.length > 1 && (
          <View style={{ marginBottom: space(6) }}>
            <SectionHeader>Recent Properties</SectionHeader>
            {properties.slice(1).map((prop) => (
              <PropertyRow
                key={prop.id}
                property={prop}
                onStart={() => router.push(`/timer?property=${prop.id}`)}
                onLog={() => router.push("/log")}
              />
            ))}
          </View>
        )}

        {/* ── Recent Activities ──────────────────────── */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: space(3) }}>
            <Text
              style={{
                fontFamily: fonts.mono,
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: colors.slate,
              }}
            >
              Recent Activities
            </Text>
            {logs.length > 5 && (
              <Pressable onPress={() => router.push("/reports")}>
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: colors.plum,
                  }}
                >
                  All {"→"}
                </Text>
              </Pressable>
            )}
          </View>
          {logs.length === 0 ? (
            <Text
              style={{
                fontFamily: fonts.serifRegular,
                fontStyle: "italic",
                fontSize: 14,
                color: colors.slate,
                paddingVertical: space(4),
              }}
            >
              No hours logged yet. Start a timer to begin.
            </Text>
          ) : (
            groupLogs(logs).map((g) => (
              <ActivityRow
                key={g.key}
                group={g}
                expanded={expandedKey === g.key}
                onToggle={() => setExpandedKey(expandedKey === g.key ? null : g.key)}
                onUpdated={loadData}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
