import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { colors, fonts, radius, space } from "@/theme/tokens";

// Placeholder dashboard — confirms auth + Supabase data access end to end.
// Phase 2 replaces this with the real dashboard (timer, KPIs, etc.).
export default function DashboardScreen() {
  const { session, signOut } = useAuth();
  const [name, setName] = useState("");

  useEffect(() => {
    async function load() {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .single();
      setName(data?.full_name || session.user.email || "");
    }
    load();
  }, [session]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={{ flex: 1, paddingHorizontal: space(7), paddingTop: space(6) }}>
        <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine }}>
          Host Hours
        </Text>
        <Text style={{ fontFamily: fonts.serif, fontSize: 32, color: colors.plum, marginTop: space(2) }}>
          Welcome{name ? `, ${name.split(" ")[0]}` : ""}.
        </Text>
        <Text style={{ fontSize: 14, color: colors.quill, marginTop: space(3), lineHeight: 21 }}>
          You&apos;re signed in. This is the Phase&nbsp;0 skeleton — the real dashboard,
          timer, and reports land in Phase&nbsp;2.
        </Text>

        <View style={{ flex: 1 }} />

        <Pressable
          onPress={signOut}
          style={{ minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.chalk, alignItems: "center", justifyContent: "center", marginBottom: space(6) }}
        >
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
