import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  getActiveTimer,
  getProperties,
  startTimer,
  stopTimer,
  type ActiveTimer,
  type Property,
} from "@/lib/db";
import { formatElapsed } from "@/lib/format";
import { Card, Empty, MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function TimerScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<Property[]>([]);
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // form state (when no timer running)
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [task, setTask] = useState("");

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) return;
    const [props, timer] = await Promise.all([getProperties(), getActiveTimer(uid)]);
    setProperties(props);
    setActive(timer);
    if (!propertyId && props[0]) setPropertyId(props[0].id);
    setLoading(false);
  }, [uid, propertyId]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  // Live elapsed counter while a timer is active.
  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    if (active) {
      const update = () =>
        setElapsed(Math.floor((Date.now() - new Date(active.started_at).getTime()) / 1000));
      update();
      tick.current = setInterval(update, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [active]);

  async function handleStart() {
    if (!uid || !propertyId) {
      setError("Pick a property first.");
      return;
    }
    setError(null);
    setBusy(true);
    const { data, error } = await startTimer(uid, propertyId, task);
    setBusy(false);
    if (error) return setError(error);
    setActive(data);
    setTask("");
  }

  async function handleStop() {
    if (!uid || !active) return;
    setError(null);
    setBusy(true);
    const { error } = await stopTimer(active.id, uid);
    setBusy(false);
    if (error) return setError(error);
    setActive(null);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  const activeProperty = properties.find((p) => p.id === active?.property_id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        <SectionLabel>Timer</SectionLabel>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {active ? (
          // ── Running ──
          <Card style={{ alignItems: "center", paddingVertical: space(10) }}>
            <MetricLabel>{activeProperty?.name ?? "Property"}</MetricLabel>
            <Text style={{ fontFamily: fonts.mono, fontSize: 48, color: colors.plum, marginVertical: space(3) }}>
              {formatElapsed(elapsed)}
            </Text>
            <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char, marginBottom: space(6) }}>
              {active.title}
            </Text>
            <Pressable
              onPress={handleStop}
              disabled={busy}
              style={{ minWidth: 180, minHeight: 52, borderRadius: radius.md, backgroundColor: colors.tangerine, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Stop &amp; save</Text>}
            </Pressable>
          </Card>
        ) : (
          // ── Idle: pick property + task, start ──
          <View>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>
              Start tracking.
            </Text>

            <MetricLabel>Property</MetricLabel>
            {properties.length === 0 ? (
              <Empty message="No properties yet. Add one on the web to start timing." />
            ) : (
              <View style={{ gap: space(2), marginBottom: space(6) }}>
                {properties.map((p) => {
                  const selected = p.id === propertyId;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPropertyId(p.id)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: space(3),
                        padding: space(4),
                        borderRadius: radius.md,
                        borderWidth: 1.5,
                        borderColor: selected ? colors.plum : colors.chalk,
                        backgroundColor: selected ? colors.plumMist : colors.cream,
                      }}
                    >
                      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                      <Text style={{ fontFamily: fonts.serif, fontSize: 16, color: colors.char }}>{p.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <MetricLabel>Task</MetricLabel>
            <TextInput
              value={task}
              onChangeText={setTask}
              placeholder="What are you working on?"
              placeholderTextColor={colors.stone}
              style={{ minHeight: 48, paddingHorizontal: space(4), borderWidth: 1, borderColor: colors.chalk, borderRadius: radius.md, fontSize: 15, color: colors.char, marginBottom: space(6) }}
            />

            <Pressable
              onPress={handleStart}
              disabled={busy || properties.length === 0}
              style={{ minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy || properties.length === 0 ? 0.5 : 1 }}
            >
              {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Start timer</Text>}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
