import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { canWriteProperties, getMyRole, getProperties, type Property } from "@/lib/db";
import { Empty, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function PropertiesScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [canWrite, setCanWrite] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!uid) return;
        const [props, role] = await Promise.all([getProperties(), getMyRole(uid)]);
        setProperties(props);
        setCanWrite(canWriteProperties(role));
        setLoading(false);
      }
      load();
    }, [uid]),
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Properties</SectionLabel>
        </View>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(5) }}>
          Your properties
        </Text>

        {canWrite && (
          <Pressable
            onPress={() => router.push("/property-new")}
            style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(5) }}
          >
            <Ionicons name="add" size={16} color={colors.plum} />
            <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.plum, textDecorationLine: "underline" }}>
              Add property
            </Text>
          </Pressable>
        )}

        {loading ? (
          <ActivityIndicator color={colors.plum} style={{ marginTop: space(8) }} />
        ) : properties.length === 0 ? (
          <Empty message={canWrite ? "No properties yet. Add your first." : "No properties have been assigned to you."} />
        ) : (
          properties.map((p) => (
            <View key={p.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: space(4.5), borderBottomWidth: 1, borderBottomColor: colors.chalk }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space(3) }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color }} />
                <Text style={{ fontFamily: fonts.serif, fontSize: 17, color: colors.char }}>{p.name}</Text>
              </View>
              <Pressable onPress={() => router.push("/timer")}>
                <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.plum, textDecorationLine: "underline" }}>
                  Start timer
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
