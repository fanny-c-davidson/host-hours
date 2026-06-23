import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { space } from "@/theme/tokens";
import {
  AuthScreen,
  Divider,
  ErrorBanner,
  Eyebrow,
  Field,
  GhostButton,
  PrimaryButton,
  Subtitle,
  TextLink,
  Title,
} from "@/components/ui";

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) return setError(error);
    router.replace("/dashboard");
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) setError(error);
    // Success navigates via the auth state change / (auth) layout redirect.
  }

  return (
    <AuthScreen>
      <Eyebrow>Sign in</Eyebrow>
      <Title>Welcome back.</Title>
      <Subtitle>Pick up where you left off.</Subtitle>

      <ErrorBanner message={error} />

      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
      />

      <View style={{ alignItems: "flex-end", marginBottom: space(5), marginTop: -space(2) }}>
        <TextLink label="Forgot password" onPress={() => router.push("/forgot-password")} />
      </View>

      <PrimaryButton label="Sign in" onPress={handleSubmit} loading={loading} />

      <Divider label="or" />
      <GhostButton label="Continue with Google" onPress={handleGoogle} loading={googleLoading} />

      <View style={{ flexDirection: "row", justifyContent: "center", gap: space(2), marginTop: space(8) }}>
        <TextLink label="New here? Create account" onPress={() => router.push("/signup")} />
      </View>
    </AuthScreen>
  );
}
