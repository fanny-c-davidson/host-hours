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

export default function SignupScreen() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setLoading(true);
    const { error, needsConfirmation } = await signUp(email.trim(), password, fullName.trim());
    setLoading(false);
    if (error) return setError(error);
    if (needsConfirmation) {
      setNotice("Check your email to confirm your account, then sign in.");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <AuthScreen>
      <Eyebrow>Get started</Eyebrow>
      <Title>Create account.</Title>
      <Subtitle>Track your hosting hours, IRS-ready.</Subtitle>

      <ErrorBanner message={error} />
      <Notice message={notice} />

      <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Jane Doe" autoCapitalize="words" autoComplete="name" />
      <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" secureTextEntry />

      <PrimaryButton label="Create account" onPress={handleSubmit} loading={loading} />

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: space(8) }}>
        <TextLink label="Already have an account? Sign in" onPress={() => router.replace("/login")} />
      </View>
    </AuthScreen>
  );
}
