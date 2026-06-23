import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { LockGate } from "@/components/lock-gate";
import { registerForPush } from "@/lib/push";
import { syncGeofences } from "@/lib/geofence";
import { colors, fonts } from "@/theme/tokens";

// Protected tab navigator (mirrors the web dock).
export default function AppLayout() {
  const { session, loading } = useAuth();

  // Once signed in: register the push token and reconcile geofences (no-op on
  // web / if auto-timer is off or permission is denied).
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    registerForPush(uid).catch(() => {});
    syncGeofences(uid).catch(() => {});
  }, [session]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream }}>
        <ActivityIndicator color={colors.plum} />
      </View>
    );
  }
  if (!session) return <Redirect href="/login" />;

  return (
    <LockGate>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.plum,
        tabBarInactiveTintColor: colors.slate,
        tabBarStyle: { backgroundColor: colors.cream, borderTopColor: colors.chalk } as any,
        tabBarLabelStyle: { fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1, textTransform: "uppercase" },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="timer"
        options={{ title: "Timer", tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="log"
        options={{ title: "Log", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="reports"
        options={{ title: "Reports", tabBarIcon: ({ color, size }) => <Ionicons name="bar-chart-outline" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }}
      />
      {/* Reached from Settings, not shown in the tab bar */}
      <Tabs.Screen name="properties" options={{ href: null }} />
      <Tabs.Screen name="property-new" options={{ href: null }} />
    </Tabs>
    </LockGate>
  );
}
