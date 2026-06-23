import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authenticate, isBiometricEnabled } from "@/lib/biometric";
import { colors, fonts, radius, space } from "@/theme/tokens";

/**
 * If biometric unlock is enabled, blocks the app behind a Face ID / fingerprint
 * prompt — on launch and whenever the app returns to the foreground.
 */
export function LockGate({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(false);
  const appState = useRef(AppState.currentState);

  const tryUnlock = useCallback(async () => {
    setChecking(true);
    const ok = await authenticate();
    setChecking(false);
    setUnlocked(ok);
  }, []);

  // Initial check.
  useEffect(() => {
    isBiometricEnabled().then((on) => {
      setEnabled(on);
      if (on) tryUnlock();
    });
  }, [tryUnlock]);

  // Re-lock when returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active" && enabled) {
        setUnlocked(false);
        tryUnlock();
      }
      appState.current = next;
    });
    return () => sub.remove();
  }, [enabled, tryUnlock]);

  if (enabled === null) {
    return (
      <View style={center}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }

  if (enabled && !unlocked) {
    return (
      <View style={center}>
        <Ionicons name="lock-closed-outline" size={40} color={colors.plum} />
        <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.plum, marginTop: space(4) }}>
          Locked
        </Text>
        <Text style={{ fontSize: 13, color: colors.slate, marginTop: space(2), marginBottom: space(6) }}>
          Unlock with Face ID or your passcode.
        </Text>
        <Pressable
          onPress={tryUnlock}
          disabled={checking}
          style={{ minHeight: 48, paddingHorizontal: space(8), borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center" }}
        >
          {checking ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Unlock</Text>}
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const center = {
  flex: 1,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  backgroundColor: colors.cream,
  padding: space(7),
};
