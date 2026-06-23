import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/lib/auth";

// Signed-in users shouldn't see the auth screens.
export default function AuthLayout() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Redirect href="/dashboard" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
