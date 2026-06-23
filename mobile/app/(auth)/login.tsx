import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, paddingHorizontal: space(7) }}
      >
        <View style={{ flex: 1, justifyContent: "center", maxWidth: 420, width: "100%", alignSelf: "center" }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine, marginBottom: space(3) }}>
            Sign in
          </Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 38, color: colors.plum, marginBottom: space(2) }}>
            Welcome back.
          </Text>
          <Text style={{ fontFamily: fonts.serifRegular, fontStyle: "italic", fontSize: 15, color: colors.quill, marginBottom: space(8) }}>
            Pick up where you left off.
          </Text>

          {error && (
            <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
              <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
            </View>
          )}

          <Field label="Email">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.stone}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              style={inputStyle}
            />
          </Field>

          <Field label="Password">
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.stone}
              secureTextEntry
              style={inputStyle}
            />
          </Field>

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={{
              marginTop: space(2),
              minHeight: 48,
              borderRadius: radius.md,
              backgroundColor: colors.plum,
              alignItems: "center",
              justifyContent: "center",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Sign in</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: space(5) }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, marginBottom: space(2) }}>
        {label}
      </Text>
      {children}
    </View>
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
  backgroundColor: colors.cream,
} as const;
