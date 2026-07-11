import { useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const SUPPORT_EMAIL = "relaxrechargerentals@gmail.com";

const SUBJECTS = [
  "Billing & subscription",
  "Report a bug",
  "Feature request",
  "Tax & IRS questions",
  "Other",
];

export default function ContactScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  function handleSend() {
    const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject || "Host Hours support")}&body=${encodeURIComponent(message)}`;
    Linking.openURL(mailto).catch(() => {});
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Support</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>Contact us.</Text>

        <MetricLabel>Subject</MetricLabel>
        <View style={{ gap: space(2) }}>
          {SUBJECTS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSubject(s)}
              style={{
                paddingHorizontal: space(4),
                paddingVertical: space(3),
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: subject === s ? colors.plum : colors.chalk,
                backgroundColor: subject === s ? colors.plumMist : colors.cream,
              }}
            >
              <Text style={{ fontSize: 14, color: subject === s ? colors.char : colors.quill }}>{s}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: space(5) }} />
        <MetricLabel>Message</MetricLabel>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us how we can help..."
          placeholderTextColor={colors.stone}
          multiline
          style={{
            minHeight: 120,
            paddingHorizontal: space(4),
            paddingVertical: space(3),
            borderWidth: 1,
            borderColor: colors.chalk,
            borderRadius: radius.md,
            fontSize: 15,
            color: colors.char,
            textAlignVertical: "top",
          }}
        />

        <Pressable
          onPress={handleSend}
          style={{ marginTop: space(7), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Send</Text>
        </Pressable>

        <Text style={{ fontSize: 12, color: colors.slate, textAlign: "center", marginTop: space(5) }}>
          You can also email us directly at{" "}
          <Text style={{ color: colors.plum, textDecorationLine: "underline" }} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
            {SUPPORT_EMAIL}
          </Text>
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
