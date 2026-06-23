import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { space } from "@/theme/tokens";
import {
  AuthScreen,
  ErrorBanner,
  Eyebrow,
  Field,
  Notice,
  PrimaryButton,
  Subtitle,
  TextLink,
  Title,
} from "@/components/ui";

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    setLoading(true);
    const { error } = await resetPassword(email.trim());
    setLoading(false);
    if (error) return setError(error);
    setNotice("If that email has an account, a reset link is on its way.");
  }

  return (
    <AuthScreen>
      <Eyebrow>Reset password</Eyebrow>
      <Title>Forgot it?</Title>
      <Subtitle>We&apos;ll email you a link to set a new one.</Subtitle>

      <ErrorBanner message={error} />
      <Notice message={notice} />

      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />

      <PrimaryButton label="Send reset link" onPress={handleSubmit} loading={loading} />

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: space(8) }}>
        <TextLink label="Back to sign in" onPress={() => router.replace("/login")} />
      </View>
    </AuthScreen>
  );
}
