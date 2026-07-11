import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { API_URL } from "@/lib/web-api";
import { Card, MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const TIER_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

// Read-only plan status. Subscriptions are purchased and managed on the web —
// no in-app purchase flow (keeps us out of App Store IAP requirements).
export default function BillingScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [cancelAtEnd, setCancelAtEnd] = useState(false);

  useEffect(() => {
    if (!uid) return;
    supabase
      .from("subscriptions")
      .select("tier_id, status, current_period_end, cancel_at_period_end")
      .eq("user_id", uid)
      .maybeSingle()
      .then(({ data }) => {
        setTier(data?.tier_id ?? null);
        setStatus(data?.status ?? null);
        setPeriodEnd(data?.current_period_end ?? null);
        setCancelAtEnd(data?.cancel_at_period_end ?? false);
        setLoading(false);
      });
  }, [uid]);

  const renewal = periodEnd
    ? new Date(periodEnd).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : null;

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
          <SectionLabel>Billing</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>Your plan.</Text>

        <Card style={{ marginBottom: space(4) }}>
          <MetricLabel>Current plan</MetricLabel>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.char }}>
              {tier ? TIER_LABEL[tier] ?? tier : "No plan"}
            </Text>
            {status && (
              <View style={{ borderWidth: 1, borderColor: status === "active" || status === "trialing" ? colors.success : colors.tangerine, borderRadius: radius.pill, paddingHorizontal: space(2.5), paddingVertical: space(1) }}>
                <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: status === "active" || status === "trialing" ? colors.success : colors.tangerine }}>
                  {status}
                </Text>
              </View>
            )}
          </View>
          {renewal && (
            <Text style={{ fontSize: 13, color: colors.slate, marginTop: space(2) }}>
              {cancelAtEnd ? `Ends ${renewal}` : `Renews ${renewal}`}
            </Text>
          )}
        </Card>

        <Text style={{ fontSize: 13, color: colors.slate, lineHeight: 19, marginBottom: space(5) }}>
          Plans are managed on the Host Hours website. Upgrades, downgrades, and
          payment details all live there.
        </Text>

        <Pressable
          onPress={() => Linking.openURL(`${API_URL}/settings/billing`)}
          style={{ minHeight: 52, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Manage plan on the web</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
