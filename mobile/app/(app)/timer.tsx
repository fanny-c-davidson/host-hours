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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import {
  createTaskType,
  getActiveTimer,
  getProperties,
  getTaskTypes,
  getTimeLog,
  getTodaySeconds,
  startTimer,
  stopTimer,
  updateActiveTimerDescription,
  updateTimeLog,
  type ActiveTimer,
  type Property,
  type TaskType,
} from "@/lib/db";
import { formatDuration, formatDurationLong, formatElapsed } from "@/lib/format";
import { ReceiptAttach } from "@/components/receipt-attach";
import { colors, fonts, radius, space } from "@/theme/tokens";

// ---------------------------------------------------------------------------
// Pulsing dot component (animated opacity loop)
// ---------------------------------------------------------------------------
function PulsingDot({ color, size = 6 }: { color: string; size?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
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
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------
function formatAmPm(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ---------------------------------------------------------------------------
// Timer Screen
// ---------------------------------------------------------------------------
export default function TimerScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const params = useLocalSearchParams<{ property?: string; task?: string; stopped?: string }>();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [properties, setProperties] = useState<Property[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [todaySecs, setTodaySecs] = useState(0);

  // Notes for active timer
  const [notes, setNotes] = useState("");
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Inline add task type
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  // Selected property (for idle mode)
  const [propertyId, setPropertyId] = useState<string | null>(null);

  // Post-stop editor state
  type StoppedEntry = {
    id: string;
    title: string;
    started_at: string;
    ended_at: string;
    duration_secs: number;
    description: string | null;
    is_onsite: boolean;
    property_id: string;
    property: { name: string } | null;
  };
  const [stoppedEntry, setStoppedEntry] = useState<StoppedEntry | null>(null);
  const [stoppedNotes, setStoppedNotes] = useState("");
  const [stoppedIsOnsite, setStoppedIsOnsite] = useState(false);
  const [stoppedSaveStatus, setStoppedSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const stoppedNoteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [stoppedStartTime, setStoppedStartTime] = useState("");
  const [stoppedEndTime, setStoppedEndTime] = useState("");
  const [editingStoppedStart, setEditingStoppedStart] = useState(false);
  const [editingStoppedEnd, setEditingStoppedEnd] = useState(false);
  const [stoppedEditBuf, setStoppedEditBuf] = useState("");

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data on focus or param change ───────────────────────────────
  const paramsProperty = params.property;
  const paramsTask = params.task;
  const paramsStopped = params.stopped;

  const refresh = useCallback(async () => {
    if (!uid) return;
    const [props, timer, types, today] = await Promise.all([
      getProperties(),
      getActiveTimer(uid),
      getTaskTypes(),
      getTodaySeconds(uid),
    ]);
    setProperties(props);
    setTaskTypes(types);
    setTodaySecs(today);
    setActive(timer);
    if (timer) {
      setNotes(timer.description ?? "");
    }

    // Set the property for idle mode
    if (!timer) {
      if (paramsProperty && props.some((p) => p.id === paramsProperty)) {
        setPropertyId(paramsProperty);
      } else if (props[0]) {
        setPropertyId((prev) => prev && props.some((p) => p.id === prev) ? prev : props[0].id);
      }
    }

    setLoading(false);

    // Auto-start from dashboard deep link (?property=X&task=Y)
    if (!timer && paramsTask && paramsProperty) {
      const pid = props.some((p) => p.id === paramsProperty) ? paramsProperty : null;
      if (pid) {
        setBusy(true);
        const { data, error: err } = await startTimer(uid, pid, paramsTask);
        setBusy(false);
        if (err) {
          setError(err);
        } else if (data) {
          setActive(data);
          setNotes("");
          setStoppedEntry(null);
        }
      }
    }
  }, [uid, paramsProperty, paramsTask]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // ── React to stopped param (dashboard → timer navigation) ───────────
  useEffect(() => {
    if (!paramsStopped) {
      setStoppedEntry(null);
      return;
    }
    getTimeLog(paramsStopped).then((entry) => {
      if (entry) {
        setStoppedEntry(entry);
        setStoppedNotes(entry.description ?? "");
        setStoppedIsOnsite(entry.is_onsite);
        const toHHMM = (iso: string) => {
          const d = new Date(iso);
          return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        };
        setStoppedStartTime(toHHMM(entry.started_at));
        setStoppedEndTime(toHHMM(entry.ended_at));
        setPropertyId(entry.property_id);
      }
    });
  }, [paramsStopped]);

  // ── Live elapsed counter ────────────────────────────────────────────
  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    if (active) {
      const update = () =>
        setElapsed(
          Math.floor(
            (Date.now() - new Date(active.started_at).getTime()) / 1000,
          ),
        );
      update();
      tick.current = setInterval(update, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [active]);

  // ── Debounced notes save ────────────────────────────────────────────
  function handleNotesChange(text: string) {
    setNotes(text);
    if (!active) return;
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      updateActiveTimerDescription(active.id, text.trim() || null);
    }, 800);
  }

  // ── Start a task ────────────────────────────────────────────────────
  async function handleStartTask(taskName: string) {
    if (!uid || !propertyId) {
      setError("Pick a property first.");
      return;
    }
    setError(null);
    setBusy(true);
    const { data, error: err } = await startTimer(uid, propertyId, taskName);
    setBusy(false);
    if (err) return setError(err);
    if (data) {
      setActive(data);
      setNotes("");
      setStoppedEntry(null);
    }
  }

  // ── Stop timer ──────────────────────────────────────────────────────
  async function handleStop() {
    if (!uid || !active) return;
    setError(null);
    setBusy(true);

    // Flush pending notes before stopping
    clearTimeout(noteTimer.current);
    if (notes.trim()) {
      await updateActiveTimerDescription(active.id, notes.trim());
    }

    const { data, error: err } = await stopTimer(active.id, uid);
    setBusy(false);
    if (err) return setError(err);
    setActive(null);
    setNotes("");

    // Show the post-stop editor
    if (data?.id) {
      const entry = await getTimeLog(data.id);
      if (entry) {
        setStoppedEntry(entry);
        setStoppedNotes(entry.description ?? "");
        setStoppedIsOnsite(entry.is_onsite);
        const toHHMM = (iso: string) => {
          const d = new Date(iso);
          return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        };
        setStoppedStartTime(toHHMM(entry.started_at));
        setStoppedEndTime(toHHMM(entry.ended_at));
      }
    }

    // Refresh today's total
    if (uid) {
      const today = await getTodaySeconds(uid);
      setTodaySecs(today);
    }
  }

  // ── Save Details (flush notes + navigate back) ──────────────────────
  async function handleSaveDetails() {
    if (!active) return;
    setSavingDetails(true);
    clearTimeout(noteTimer.current);
    await updateActiveTimerDescription(active.id, notes.trim() || null);
    setSavingDetails(false);
    router.push("/dashboard");
  }

  // ── Add a new task type inline ──────────────────────────────────────
  async function handleAddTaskType() {
    const name = newTaskName.trim();
    if (!name || !uid) return;
    const maxOrder =
      taskTypes.length > 0
        ? Math.max(...taskTypes.map((t) => t.sort_order)) + 1
        : 0;
    const created = await createTaskType(uid, name, maxOrder);
    if (created) {
      setTaskTypes((prev) => [...prev, created]);
    }
    setNewTaskName("");
    setAddingTask(false);
  }

  // ── Stopped entry: auto-save helpers ─────────────────────────────────
  function displayAmPmStopped(hhmm: string): string {
    if (!hhmm.includes(":")) return "--:-- --";
    const [h, m] = hhmm.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  function parseTimeInputStopped(text: string): string | null {
    const clean = text.trim().toUpperCase();
    const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
    if (match12) {
      let h = parseInt(match12[1], 10);
      const m = parseInt(match12[2], 10);
      const period = match12[3];
      if (h < 1 || h > 12 || m > 59) return null;
      if (period === "AM" && h === 12) h = 0;
      else if (period === "PM" && h !== 12) h += 12;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      const h = parseInt(match24[1], 10);
      const m = parseInt(match24[2], 10);
      if (h > 23 || m > 59) return null;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return null;
  }

  const stoppedCommitted = useRef(false);
  function commitStoppedTime(field: "start" | "end", raw: string) {
    if (!stoppedEntry || stoppedCommitted.current) return;
    stoppedCommitted.current = true;
    const hhmm = parseTimeInputStopped(raw);
    if (!hhmm) return;
    const d = new Date(stoppedEntry.started_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    let st = field === "start" ? hhmm : stoppedStartTime;
    let en = field === "end" ? hhmm : stoppedEndTime;
    if (st > en) { const tmp = st; st = en; en = tmp; }
    setStoppedStartTime(st);
    setStoppedEndTime(en);
    const newStart = new Date(`${dateStr}T${st}:00`);
    const newEnd = new Date(`${dateStr}T${en}:00`);
    saveStoppedField({ started_at: newStart.toISOString(), ended_at: newEnd.toISOString() });
  }

  async function saveStoppedField(fields: Parameters<typeof updateTimeLog>[1]) {
    if (!stoppedEntry) return;
    setStoppedSaveStatus("saving");
    await updateTimeLog(stoppedEntry.id, fields);
    setStoppedSaveStatus("saved");
    setTimeout(() => setStoppedSaveStatus("idle"), 1500);
  }

  function handleStoppedNotesChange(text: string) {
    setStoppedNotes(text);
    if (!stoppedEntry) return;
    clearTimeout(stoppedNoteTimer.current);
    stoppedNoteTimer.current = setTimeout(() => {
      saveStoppedField({ description: text.trim() || null });
    }, 800);
  }

  function handleStoppedOnsiteToggle(onsite: boolean) {
    setStoppedIsOnsite(onsite);
    saveStoppedField({ is_onsite: onsite });
  }

  function handleStoppedDone() {
    clearTimeout(stoppedNoteTimer.current);
    if (stoppedEntry && stoppedNotes.trim()) {
      updateTimeLog(stoppedEntry.id, { description: stoppedNotes.trim() });
    }
    setStoppedEntry(null);
    router.push("/dashboard");
  }

  // ── Loading state ───────────────────────────────────────────────────
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

  const activeProperty = properties.find(
    (p) => p.id === (active ? active.property_id : propertyId),
  );

  // ====================================================================
  // RENDER
  // ====================================================================
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.cream }}
      edges={["top"]}
    >
      <ScrollView
        contentContainerStyle={{
          paddingBottom: space(12),
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Error banner */}
        {error && (
          <View
            style={{
              marginHorizontal: space(7),
              marginTop: space(4),
              padding: space(3),
              borderRadius: radius.md,
              backgroundColor: colors.tangerineGlow,
            }}
          >
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>
              {error}
            </Text>
          </View>
        )}

        {active ? (
          // ════════════════════════════════════════════════════════
          // RUNNING MODE
          // ════════════════════════════════════════════════════════
          <>
            {/* Property name header */}
            <View
              style={{
                paddingHorizontal: space(7),
                paddingTop: space(5),
                paddingBottom: space(3),
                borderBottomWidth: 1,
                borderBottomColor: colors.chalk,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 22,
                  color: colors.char,
                }}
                numberOfLines={1}
              >
                {activeProperty?.name ?? "Property"}
              </Text>
            </View>

            {/* Task pill with pulsing dot + big clock + time bar + stop button */}
            <View
              style={{
                alignItems: "center",
                paddingHorizontal: space(7),
                paddingTop: space(8),
                paddingBottom: space(6),
              }}
            >
              {/* Task pill */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space(2),
                  paddingHorizontal: space(4),
                  paddingVertical: space(2),
                  borderWidth: 1,
                  borderColor: colors.tangerine,
                  borderRadius: radius.pill,
                }}
              >
                <PulsingDot color={colors.tangerine} />
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    color: colors.tangerine,
                    fontWeight: "500",
                  }}
                >
                  {active.title}
                </Text>
              </View>

              {/* Big clock */}
              <Text
                style={{
                  fontFamily: fonts.serif,
                  fontSize: 72,
                  color: colors.plum,
                  letterSpacing: -3,
                  lineHeight: 80,
                  marginTop: space(4),
                }}
              >
                {formatElapsed(elapsed)}
              </Text>

              {/* Time range bar */}
              <View style={{ width: "100%", maxWidth: 280, marginTop: space(8) }}>
                {/* Track */}
                <View
                  style={{
                    height: 3,
                    backgroundColor: "rgba(74, 20, 140, 0.2)",
                    borderRadius: radius.pill,
                    marginHorizontal: 6,
                  }}
                >
                  {/* Filled bar */}
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: colors.plum,
                      borderRadius: radius.pill,
                    }}
                  />
                  {/* Start circle */}
                  <View
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: colors.plum,
                      borderWidth: 2,
                      borderColor: colors.cream,
                      transform: [{ translateX: -6 }, { translateY: -6 }],
                    }}
                  />
                  {/* End circle (pulsing tangerine) */}
                  <View
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 0,
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: colors.cream,
                      transform: [{ translateX: 6 }, { translateY: -6 }],
                      overflow: "hidden",
                    }}
                  >
                    <PulsingDot color={colors.tangerine} size={12} />
                  </View>
                </View>

                {/* Labels below the bar */}
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginTop: space(2),
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: colors.slate,
                    }}
                  >
                    {formatAmPm(new Date(active.started_at))}
                  </Text>
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 11,
                      color: colors.tangerine,
                      fontWeight: "500",
                    }}
                  >
                    now
                  </Text>
                </View>
              </View>

              {/* Stop button */}
              <Pressable
                onPress={handleStop}
                disabled={busy}
                style={{
                  marginTop: space(8),
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: colors.plum,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busy ? 0.5 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      backgroundColor: colors.cream,
                    }}
                  />
                )}
              </Pressable>
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: colors.quill,
                  marginTop: space(2),
                }}
              >
                {busy ? "Saving..." : "Stop"}
              </Text>
            </View>

            {/* Notes / Purpose */}
            <View
              style={{
                paddingHorizontal: space(7),
                paddingVertical: space(5),
                borderTopWidth: 1,
                borderTopColor: colors.chalk,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: colors.quill,
                  fontWeight: "500",
                  marginBottom: space(2),
                }}
              >
                NOTES / PURPOSE
              </Text>
              <TextInput
                value={notes}
                onChangeText={handleNotesChange}
                placeholder="What did you work on?"
                placeholderTextColor={colors.stone}
                multiline
                style={{
                  minHeight: 80,
                  paddingHorizontal: space(4),
                  paddingVertical: space(3),
                  borderWidth: 1,
                  borderColor: colors.chalk,
                  borderRadius: radius.md,
                  fontSize: 14,
                  color: colors.char,
                  backgroundColor: colors.cream,
                  textAlignVertical: "top",
                }}
              />
            </View>

            {/* Photos or Documents (disabled while running) */}
            <View
              style={{
                paddingHorizontal: space(7),
                paddingVertical: space(5),
                borderTopWidth: 1,
                borderTopColor: colors.chalk,
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: colors.quill,
                  fontWeight: "500",
                  marginBottom: space(2),
                }}
              >
                PHOTOS OR DOCUMENTS
              </Text>
              <View style={{ flexDirection: "row", gap: space(3) }}>
                {/* Gallery placeholder */}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: space(2),
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.stone,
                    borderRadius: radius.md,
                    paddingVertical: space(3),
                    opacity: 0.5,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: colors.quill,
                      fontWeight: "500",
                    }}
                  >
                    Gallery
                  </Text>
                </View>
                {/* Camera placeholder */}
                <View
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: space(2),
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.stone,
                    borderRadius: radius.md,
                    paddingVertical: space(3),
                    opacity: 0.5,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: colors.quill,
                      fontWeight: "500",
                    }}
                  >
                    Camera
                  </Text>
                </View>
              </View>
              <Text
                style={{
                  fontSize: 11,
                  color: colors.slate,
                  marginTop: space(2),
                }}
              >
                Available after saving the entry.
              </Text>
            </View>

            {/* Save Details button */}
            <View
              style={{
                paddingHorizontal: space(7),
                paddingVertical: space(6),
              }}
            >
              <Pressable
                onPress={handleSaveDetails}
                disabled={savingDetails}
                style={{
                  paddingVertical: space(3.5),
                  borderRadius: radius.pill,
                  backgroundColor: colors.plum,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: savingDetails ? 0.5 : 1,
                }}
              >
                {savingDetails ? (
                  <ActivityIndicator color={colors.cream} />
                ) : (
                  <Text
                    style={{
                      fontFamily: fonts.mono,
                      fontSize: 12,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      color: colors.cream,
                      fontWeight: "500",
                    }}
                  >
                    Save Details
                  </Text>
                )}
              </Pressable>
            </View>
          </>
        ) : (
          // ════════════════════════════════════════════════════════
          // IDLE MODE (with optional post-stop editor)
          // ════════════════════════════════════════════════════════
          <>
            {/* ── Just Saved: post-stop editor ─────────────────── */}
            {stoppedEntry && (
              <>
                {/* Plum banner */}
                <View
                  style={{
                    backgroundColor: colors.plum,
                    paddingHorizontal: space(5),
                    paddingTop: space(7),
                    paddingBottom: space(6),
                  }}
                >
                  {/* Top row: checkmark + duration + Done link */}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: space(4),
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: space(3), flex: 1 }}>
                      {/* Checkmark */}
                      <Text style={{ fontSize: 22, color: colors.tangerine }}>✓</Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: fonts.serif,
                            fontSize: 26,
                            fontWeight: "500",
                            color: colors.cream,
                            lineHeight: 30,
                          }}
                        >
                          {formatDurationLong(stoppedEntry.duration_secs)} saved
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.6)",
                            marginTop: 2,
                          }}
                          numberOfLines={1}
                        >
                          {stoppedEntry.property?.name ?? activeProperty?.name ?? "—"}
                        </Text>
                      </View>
                    </View>
                    <Pressable
                      onPress={handleStoppedDone}
                      style={{
                        minHeight: 44,
                        paddingHorizontal: space(5),
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: colors.tangerine,
                        borderRadius: radius.pill,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          color: colors.cream,
                          fontWeight: "600",
                        }}
                      >
                        Done →
                      </Text>
                    </Pressable>
                  </View>

                  {/* Entry editor card */}
                  <View
                    style={{
                      backgroundColor: colors.cream,
                      borderRadius: 12,
                      padding: space(4),
                    }}
                  >
                    {/* Title + duration header */}
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: space(1),
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: fonts.mono,
                          fontSize: 11,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          color: colors.char,
                          fontWeight: "500",
                        }}
                      >
                        {stoppedEntry.title}
                      </Text>
                      <Text
                        style={{
                          fontFamily: fonts.serif,
                          fontSize: 18,
                          color: colors.plum,
                          fontWeight: "500",
                        }}
                      >
                        {formatDuration(stoppedEntry.duration_secs)}
                      </Text>
                    </View>

                    {/* Save status indicator */}
                    <View style={{ alignItems: "flex-end", height: 16, marginBottom: space(1) }}>
                      {stoppedSaveStatus === "saving" && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <ActivityIndicator size="small" color={colors.slate} />
                          <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.slate }}>
                            Saving
                          </Text>
                        </View>
                      )}
                      {stoppedSaveStatus === "saved" && (
                        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.success }}>
                          ✓ Saved
                        </Text>
                      )}
                    </View>

                    {/* Time range bar */}
                    <View style={{ marginHorizontal: 6 }}>
                      <View
                        style={{
                          height: 3,
                          backgroundColor: "rgba(74, 20, 140, 0.15)",
                          borderRadius: radius.pill,
                        }}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: "rgba(74, 20, 140, 0.7)",
                            borderRadius: radius.pill,
                          }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: 0,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.plum,
                            borderWidth: 2,
                            borderColor: colors.cream,
                            transform: [{ translateX: -5 }, { translateY: -5 }],
                          }}
                        />
                        <View
                          style={{
                            position: "absolute",
                            top: "50%",
                            right: 0,
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: colors.plum,
                            borderWidth: 2,
                            borderColor: colors.cream,
                            transform: [{ translateX: 5 }, { translateY: -5 }],
                          }}
                        />
                      </View>
                      {/* Editable time inputs */}
                      <View
                        style={{
                          flexDirection: "row",
                          justifyContent: "space-between",
                          marginTop: space(2.5),
                        }}
                      >
                        {/* Start time */}
                        {editingStoppedStart ? (
                          <TextInput
                            autoFocus
                            value={stoppedEditBuf}
                            onChangeText={setStoppedEditBuf}
                            onBlur={() => { commitStoppedTime("start", stoppedEditBuf); setEditingStoppedStart(false); }}
                            onSubmitEditing={() => { commitStoppedTime("start", stoppedEditBuf); setEditingStoppedStart(false); }}
                            placeholder="1:30 PM"
                            placeholderTextColor={colors.stone}
                            style={{
                              minWidth: 100,
                              paddingHorizontal: space(2.5),
                              paddingVertical: space(1.5),
                              borderWidth: 1,
                              borderColor: colors.plum,
                              borderRadius: radius.md,
                              fontSize: 13,
                              color: colors.char,
                              backgroundColor: colors.cream,
                            }}
                          />
                        ) : (
                          <Pressable
                            onPress={() => { stoppedCommitted.current = false; setStoppedEditBuf(displayAmPmStopped(stoppedStartTime)); setEditingStoppedStart(true); }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: space(1.5),
                              paddingHorizontal: space(2.5),
                              paddingVertical: space(1.5),
                              borderWidth: 1,
                              borderColor: colors.chalk,
                              borderRadius: radius.md,
                            }}
                          >
                            <Text style={{ fontSize: 13, color: colors.char }}>{displayAmPmStopped(stoppedStartTime)}</Text>
                            <Ionicons name="time-outline" size={14} color={colors.plum} />
                          </Pressable>
                        )}

                        {/* End time */}
                        {editingStoppedEnd ? (
                          <TextInput
                            autoFocus
                            value={stoppedEditBuf}
                            onChangeText={setStoppedEditBuf}
                            onBlur={() => { commitStoppedTime("end", stoppedEditBuf); setEditingStoppedEnd(false); }}
                            onSubmitEditing={() => { commitStoppedTime("end", stoppedEditBuf); setEditingStoppedEnd(false); }}
                            placeholder="2:30 PM"
                            placeholderTextColor={colors.stone}
                            style={{
                              minWidth: 100,
                              paddingHorizontal: space(2.5),
                              paddingVertical: space(1.5),
                              borderWidth: 1,
                              borderColor: colors.plum,
                              borderRadius: radius.md,
                              fontSize: 13,
                              color: colors.char,
                              backgroundColor: colors.cream,
                            }}
                          />
                        ) : (
                          <Pressable
                            onPress={() => { stoppedCommitted.current = false; setStoppedEditBuf(displayAmPmStopped(stoppedEndTime)); setEditingStoppedEnd(true); }}
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: space(1.5),
                              paddingHorizontal: space(2.5),
                              paddingVertical: space(1.5),
                              borderWidth: 1,
                              borderColor: colors.chalk,
                              borderRadius: radius.md,
                            }}
                          >
                            <Text style={{ fontSize: 13, color: colors.char }}>{displayAmPmStopped(stoppedEndTime)}</Text>
                            <Ionicons name="time-outline" size={14} color={colors.plum} />
                          </Pressable>
                        )}
                      </View>
                    </View>

                    {/* Location toggle */}
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: colors.quill,
                        fontWeight: "500",
                        marginTop: space(4),
                        marginBottom: space(2),
                      }}
                    >
                      Location
                    </Text>
                    <View style={{ flexDirection: "row", gap: space(2) }}>
                      <Pressable
                        onPress={() => handleStoppedOnsiteToggle(true)}
                        style={{
                          flex: 1,
                          paddingVertical: space(2.5),
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: stoppedIsOnsite ? colors.plum : colors.chalk,
                          backgroundColor: stoppedIsOnsite ? colors.plum : colors.cream,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.mono,
                            fontSize: 11,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: stoppedIsOnsite ? colors.cream : colors.quill,
                            fontWeight: "500",
                          }}
                        >
                          On-site
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleStoppedOnsiteToggle(false)}
                        style={{
                          flex: 1,
                          paddingVertical: space(2.5),
                          borderRadius: radius.md,
                          borderWidth: 1,
                          borderColor: !stoppedIsOnsite ? colors.plum : colors.chalk,
                          backgroundColor: !stoppedIsOnsite ? colors.plum : colors.cream,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: fonts.mono,
                            fontSize: 11,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            color: !stoppedIsOnsite ? colors.cream : colors.quill,
                            fontWeight: "500",
                          }}
                        >
                          Remote
                        </Text>
                      </Pressable>
                    </View>

                    {/* Notes */}
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: colors.quill,
                        fontWeight: "500",
                        marginTop: space(4),
                        marginBottom: space(2),
                      }}
                    >
                      Notes
                    </Text>
                    <TextInput
                      value={stoppedNotes}
                      onChangeText={handleStoppedNotesChange}
                      placeholder="What did you work on?"
                      placeholderTextColor={colors.stone}
                      multiline
                      style={{
                        minHeight: 60,
                        paddingHorizontal: space(4),
                        paddingVertical: space(3),
                        borderWidth: 1,
                        borderColor: colors.chalk,
                        borderRadius: radius.md,
                        fontSize: 14,
                        color: colors.char,
                        backgroundColor: colors.cream,
                        textAlignVertical: "top",
                      }}
                    />

                    {/* Receipts or photos */}
                    <Text
                      style={{
                        fontFamily: fonts.mono,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        color: colors.quill,
                        fontWeight: "500",
                        marginTop: space(4),
                        marginBottom: space(2),
                      }}
                    >
                      Receipts or photos
                    </Text>
                    <ReceiptAttach timeLogIds={[stoppedEntry.id]} />
                  </View>
                </View>
              </>
            )}

            {!stoppedEntry && (
            <>
            {/* Header: DATE / PROPERTY */}
            <View
              style={{
                paddingHorizontal: space(7),
                paddingTop: space(5),
                paddingBottom: space(4),
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              <View>
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: colors.slate,
                    fontWeight: "500",
                  }}
                >
                  Date
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 18,
                    color: colors.char,
                    fontWeight: "500",
                    marginTop: space(1),
                  }}
                >
                  Today
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: colors.slate,
                    fontWeight: "500",
                  }}
                >
                  Property
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 18,
                    color: colors.char,
                    fontWeight: "500",
                    marginTop: space(1),
                  }}
                  numberOfLines={1}
                >
                  {activeProperty?.name ?? "—"}
                </Text>
              </View>
            </View>

            {/* "Start A Task" pills in bone container */}
            <View
              style={{
                paddingHorizontal: space(7),
                paddingVertical: space(5),
              }}
            >
              <Text
                style={{
                  fontFamily: fonts.mono,
                  fontSize: 10,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: colors.quill,
                  fontWeight: "500",
                  marginBottom: space(3),
                }}
              >
                Start A Task
              </Text>
              <View
                style={{
                  backgroundColor: "rgba(237,229,212,0.3)",
                  borderRadius: 16,
                  padding: space(4),
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: space(2),
                    alignItems: "center",
                  }}
                >
                  {taskTypes.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => handleStartTask(t.name)}
                      disabled={busy || !propertyId}
                      style={{
                        minHeight: 40,
                        paddingHorizontal: space(4),
                        paddingVertical: space(2),
                        borderRadius: radius.pill,
                        backgroundColor: colors.cream,
                        borderWidth: 1,
                        borderColor: colors.chalk,
                        opacity: busy || !propertyId ? 0.5 : 1,
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "500",
                          color: colors.quill,
                          lineHeight: 18,
                        }}
                      >
                        {t.name}
                      </Text>
                    </Pressable>
                  ))}

                  {!addingTask ? (
                    <Pressable
                      onPress={() => setAddingTask(true)}
                      style={{
                        minHeight: 40,
                        paddingHorizontal: space(4),
                        paddingVertical: space(2),
                        borderRadius: radius.pill,
                        borderWidth: 1,
                        borderStyle: "dashed",
                        borderColor: colors.stone,
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "500",
                          color: colors.stone,
                          lineHeight: 18,
                        }}
                      >
                        + Add
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {addingTask && (
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: space(2),
                      marginTop: space(3),
                    }}
                  >
                    <TextInput
                      value={newTaskName}
                      onChangeText={setNewTaskName}
                      placeholder="New task type"
                      placeholderTextColor={colors.stone}
                      autoFocus
                      onSubmitEditing={handleAddTaskType}
                      style={{
                        flex: 1,
                        minHeight: 40,
                        paddingHorizontal: space(3.5),
                        paddingVertical: space(2),
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.chalk,
                        color: colors.char,
                        fontSize: 14,
                        backgroundColor: colors.cream,
                      }}
                    />
                    <Pressable
                      onPress={handleAddTaskType}
                      style={{
                        minHeight: 40,
                        paddingHorizontal: space(4),
                        paddingVertical: space(2),
                        borderRadius: radius.md,
                        backgroundColor: colors.plum,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "500",
                          color: colors.cream,
                        }}
                      >
                        Add
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setAddingTask(false);
                        setNewTaskName("");
                      }}
                      style={{
                        minHeight: 40,
                        paddingHorizontal: space(3),
                        paddingVertical: space(2),
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          color: colors.quill,
                        }}
                      >
                        Cancel
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>

            {/* Today summary (only when seconds > 0) */}
            {todaySecs > 0 && (
              <View
                style={{
                  marginHorizontal: space(7),
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  paddingVertical: space(3),
                  borderTopWidth: 1,
                  borderBottomWidth: 1,
                  borderColor: colors.chalk,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.mono,
                    fontSize: 11,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: colors.slate,
                    fontWeight: "500",
                  }}
                >
                  Today
                </Text>
                <Text
                  style={{
                    fontFamily: fonts.serif,
                    fontSize: 18,
                    color: colors.plum,
                    fontWeight: "500",
                  }}
                >
                  {formatDuration(todaySecs)} logged
                </Text>
              </View>
            )}
            </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
