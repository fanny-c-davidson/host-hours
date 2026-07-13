import { useEffect } from "react";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { HomeIcon, HoursIcon, PlusIcon, PropertiesIcon, SettingsIcon } from "@/components/dock-icons";
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
          // Matches the web Dock (src/components/dock.tsx): plum active,
          // slate inactive, mono 9px tracked-out uppercase labels, chalk
          // hairline on a cream bar.
          tabBarActiveTintColor: colors.plum,
          tabBarInactiveTintColor: colors.slate,
          tabBarStyle: {
            backgroundColor: colors.cream,
            borderTopWidth: 1,
            borderTopColor: colors.chalk,
            paddingTop: space(3),
            height: 84,
          } as any,
          tabBarItemStyle: {
            gap: 4,
          } as any,
          tabBarLabelStyle: {
            fontFamily: fonts.mono,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: "uppercase",
            fontWeight: "500",
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: "Home",
            tabBarIcon: ({ color }) => <HomeIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{
            title: "Hours",
            tabBarIcon: ({ color }) => <HoursIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: "Log",
            // Center FAB: 40px plum circle, cream plus — label stays plum like web.
            tabBarActiveTintColor: colors.plum,
            tabBarInactiveTintColor: colors.plum,
            tabBarIcon: () => (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.plum,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: -10,
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 3,
                  shadowOffset: { width: 0, height: 1 },
                  elevation: 2,
                }}
              >
                <PlusIcon color={colors.cream} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="properties"
          options={{
            title: "Properties",
            tabBarIcon: ({ color }) => <PropertiesIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Settings",
            tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
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
        <Tabs.Screen name="settings-billing" options={{ href: null }} />
        <Tabs.Screen name="settings-team" options={{ href: null }} />
        <Tabs.Screen name="team-invite" options={{ href: null }} />
        <Tabs.Screen name="team-member" options={{ href: null }} />
      </Tabs>
    </LockGate>
  );
}
