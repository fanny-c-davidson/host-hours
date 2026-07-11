import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { LockGate } from "@/components/lock-gate";
import { registerForPush } from "@/lib/push";
import { syncGeofences } from "@/lib/geofence";
import { colors, fonts, space } from "@/theme/tokens";

// Protected tab navigator — mirrors the web Dock.
// Tab order: Home, Hours, Log (center FAB), Properties, Settings
export default function AppLayout() {
  const { session, loading } = useAuth();

  // Once signed in: register the push token and reconcile geofences.
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
          tabBarStyle: {
            backgroundColor: colors.cream,
            borderTopWidth: 1,
            borderTopColor: colors.chalk,
            paddingTop: space(1),
          } as any,
          tabBarLabelStyle: {
            fontFamily: fonts.mono,
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: "uppercase",
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Hours",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bar-chart-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: "Log",
            tabBarIcon: ({ focused, size }) => (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.plum,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <Ionicons name="add" color={colors.cream} size={20} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="properties"
          options={{
            title: "Properties",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="business-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="settings-outline" color={color} size={size} />
            ),
          }}
        />
        {/* Hidden screens — reachable via navigation but not shown in the tab bar */}
        <Tabs.Screen name="timer" options={{ href: null }} />
        <Tabs.Screen name="property-new" options={{ href: null }} />
        <Tabs.Screen name="property-edit" options={{ href: null }} />
        <Tabs.Screen name="settings-profile" options={{ href: null }} />
        <Tabs.Screen name="settings-password" options={{ href: null }} />
        <Tabs.Screen name="settings-tax" options={{ href: null }} />
        <Tabs.Screen name="settings-contact" options={{ href: null }} />
      </Tabs>
    </LockGate>
  );
}
