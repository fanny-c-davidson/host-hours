import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { getMyRole, getProfile, isStaff as isStaffRole, updateTaxSettings } from "@/lib/db";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const TARGET_TESTS = [
  { id: "500", label: "500 hours", description: "Generally requires 500+ hours of participation. Consult your tax advisor." },
  { id: "100", label: "100 hours", description: "Generally requires 100+ hours and that no one else participates more." },
  { id: "substantially", label: "Substantially all", description: "Generally requires performing substantially all work on the activity." },
];

export default function TaxSettingsScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState(false);
  const [years, setYears] = useState<string[]>([String(new Date().getFullYear())]);
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [targetTest, setTargetTest] = useState("500");
  const [goalHours, setGoalHours] = useState("500");
  const [addingYear, setAddingYear] = useState(false);
  const [newYear, setNewYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    Promise.all([getProfile(uid), getMyRole(uid)]).then(([p, role]) => {
      const isStaff = isStaffRole(role);
      setStaff(isStaff);
      if (p) {
        const savedYear = String(p.tax_year ?? new Date().getFullYear());
        setTaxYear(savedYear);
        setYears((prev) => (prev.includes(savedYear) ? prev : [...prev, savedYear].sort().reverse()));
        setTargetTest(p.target_test ?? "500");
        // Helpers/managers have no IRS target test; their goal defaults to 100.
        const goal = p.goal_hours ?? 500;
        setGoalHours(String(isStaff && goal === 500 ? 100 : goal));
      }
      setLoading(false);
    });
  }, [uid]);

  function commitNewYear() {
    const y = newYear.trim();
    if (y.length === 4 && !years.includes(y)) {
      setYears((prev) => [...prev, y].sort().reverse());
      setTaxYear(y);
    }
    setNewYear("");
    setAddingYear(false);
  }

  async function handleSave() {
    setError(null);
    const hours = parseInt(goalHours, 10);
    if (!hours || hours < 1) return setError("Please enter a valid goal (at least 1 hour).");
    setBusy(true);
    const { error: err } = await updateTaxSettings(uid!, {
      tax_year: parseInt(taxYear, 10),
      target_test: targetTest,
      goal_hours: hours,
    });
    setBusy(false);
    if (err) return setError(err);
    router.back();
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
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Tax</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>Tax settings.</Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        <MetricLabel>Tax year</MetricLabel>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2) }}>
          {years.map((y) => (
            <Pressable
              key={y}
              onPress={() => setTaxYear(y)}
              style={{
                paddingHorizontal: space(5),
                paddingVertical: space(2.5),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: taxYear === y ? colors.plum : colors.chalk,
                backgroundColor: taxYear === y ? colors.plumMist : colors.cream,
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: "500", color: taxYear === y ? colors.char : colors.quill }}>{y}</Text>
            </Pressable>
          ))}
          {!addingYear && (
            <Pressable
              onPress={() => setAddingYear(true)}
              style={{ paddingHorizontal: space(4), paddingVertical: space(2.5), borderRadius: radius.md, borderWidth: 1, borderStyle: "dashed", borderColor: colors.stone }}
            >
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.stone }}>+ Add year</Text>
            </Pressable>
          )}
        </View>
        {addingYear && (
          <View style={{ flexDirection: "row", gap: space(2), marginTop: space(3), alignItems: "center" }}>
            <TextInput
              value={newYear}
              onChangeText={setNewYear}
              onSubmitEditing={commitNewYear}
              autoFocus
              keyboardType="number-pad"
              placeholder="e.g. 2027"
              placeholderTextColor={colors.stone}
              maxLength={4}
              style={{ ...inputStyle, width: 110 }}
            />
            <Pressable onPress={commitNewYear} style={{ paddingHorizontal: space(4), paddingVertical: space(2.5), borderRadius: radius.md, backgroundColor: colors.plum }}>
              <Text style={{ color: colors.cream, fontSize: 13, fontWeight: "500" }}>Add</Text>
            </Pressable>
            <Pressable onPress={() => { setAddingYear(false); setNewYear(""); }}>
              <Text style={{ color: colors.quill, fontSize: 13 }}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {!staff && (
          <>
            <View style={{ height: space(6) }} />
            <MetricLabel>Target test</MetricLabel>
            <View style={{ gap: space(2) }}>
              {TARGET_TESTS.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setTargetTest(t.id);
                    if (t.id === "500") setGoalHours("500");
                    if (t.id === "100") setGoalHours("100");
                  }}
                  style={{
                    padding: space(4),
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: targetTest === t.id ? colors.plum : colors.chalk,
                    backgroundColor: targetTest === t.id ? colors.plumMist : colors.cream,
                  }}
                >
                  <Text style={{ fontFamily: fonts.serif, fontSize: 16, fontWeight: "500", color: colors.char }}>{t.label}</Text>
                  <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(1), lineHeight: 17 }}>{t.description}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={{ height: space(6) }} />
        <MetricLabel>Annual goal (hours)</MetricLabel>
        <TextInput
          value={goalHours}
          onChangeText={setGoalHours}
          keyboardType="number-pad"
          placeholderTextColor={colors.stone}
          style={inputStyle}
        />
        <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(2) }}>
          This sets the progress bar target on your dashboard and reports.
        </Text>

        <Pressable
          onPress={handleSave}
          disabled={busy}
          style={{ marginTop: space(8), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
        >
          {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Save changes</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: space(4),
  borderWidth: 1,
  borderColor: colors.chalk,
  borderRadius: radius.md,
  fontSize: 15,
  color: colors.char,
} as const;
