import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, type TextStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  canWriteProperties,
  getMyRole,
  getPropertyList,
  type PropertyListItem,
} from "@/lib/db";
import { SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

export default function PropertiesScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<PropertyListItem[]>([]);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);

  useFocusEffect(
    useCallback(() => {
      async function load() {
        if (!uid) return;
        const [props, role] = await Promise.all([getPropertyList(uid), getMyRole(uid)]);
        setProperties(props);
        setCanWrite(canWriteProperties(role));
        setLoading(false);
      }
      load();
    }, [uid]),
  );

  const allTags = Array.from(new Set(properties.flatMap((p) => p.tags))).sort();
  const filtered = activeTag ? properties.filter((p) => p.tags.includes(activeTag)) : properties;
  const activeCount = filtered.filter((p) => !p.isDeleted).length;
  const deletedCount = filtered.length - activeCount;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: space(12) }}>
        <View style={{ paddingHorizontal: space(7), paddingTop: space(4) }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color={colors.quill} />
            </Pressable>
            <SectionLabel>Properties</SectionLabel>
          </View>

          {/* Title + active count (matches web header) */}
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: space(4) }}>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum }}>
              Your properties
            </Text>
            {!loading && filtered.length > 0 && (
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, color: colors.slate }}>
                {deletedCount === 0 ? `${activeCount} active` : `${activeCount} active, ${deletedCount} deleted`}
              </Text>
            )}
          </View>

          {canWrite && (
            <Pressable
              onPress={() => router.push("/property-new")}
              style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(4), alignSelf: "flex-start" }}
            >
              <Ionicons name="add" size={16} color={colors.plum} />
              <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.plum, textDecorationLine: "underline", textDecorationColor: colors.tangerine }}>
                Add property
              </Text>
            </Pressable>
          )}
        </View>

        {/* Tag filter (only when tags exist, like web) */}
        {allTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space(7), paddingBottom: space(4), gap: space(2) }}>
            <TagPill label="All" active={!activeTag} onPress={() => setActiveTag(null)} />
            {allTags.map((tag) => (
              <TagPill key={tag} label={tag} active={activeTag === tag} onPress={() => setActiveTag(activeTag === tag ? null : tag)} />
            ))}
          </ScrollView>
        )}

        {loading ? (
          <ActivityIndicator color={colors.plum} style={{ marginTop: space(8) }} />
        ) : filtered.length === 0 ? (
          <View style={{ paddingHorizontal: space(7), paddingVertical: space(16), alignItems: "center" }}>
            {activeTag ? (
              <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.quill }}>
                No properties match “{activeTag}”
              </Text>
            ) : (
              <>
                <Text style={{ fontFamily: fonts.serif, fontSize: 22, color: colors.plum, marginBottom: space(2) }}>
                  No properties yet
                </Text>
                <Text style={{ fontSize: 13, color: colors.quill, textAlign: "center", maxWidth: 280, lineHeight: 19 }}>
                  {canWrite
                    ? "Add your first short-term rental property to start tracking hours."
                    : "No properties have been assigned to you."}
                </Text>
              </>
            )}
          </View>
        ) : (
          filtered.map((p) => (
            <View
              key={p.id}
              style={{
                paddingHorizontal: space(7),
                paddingVertical: space(5),
                borderBottomWidth: 1,
                borderBottomColor: colors.chalk,
                flexDirection: "row",
                opacity: p.isDeleted ? 0.6 : 1,
              }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: p.color, marginTop: 7, marginRight: space(3) }} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: space(2) }}>
                  <Text style={{ fontFamily: fonts.serif, fontSize: 19, fontWeight: "500", color: colors.char, letterSpacing: -0.3 }} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {p.isDeleted && (
                    <View style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.pill, backgroundColor: "rgba(180,178,169,0.2)" }}>
                      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: colors.slate }}>
                        Deleted
                      </Text>
                    </View>
                  )}
                </View>
                {p.address && (
                  <Text style={{ fontSize: 12, color: colors.slate, marginTop: space(1) }} numberOfLines={1}>
                    {p.address}
                  </Text>
                )}
                {p.tags.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(1.5), marginTop: space(1.5) }}>
                    {p.tags.map((tag) => (
                      <View key={tag} style={{ paddingHorizontal: space(2), paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.plumMist }}>
                        <Text style={{ fontSize: 11, fontWeight: "500", color: colors.plum }}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {!p.isDeleted && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: space(4), marginTop: space(3) }}>
                    {canWrite && (
                      <Pressable onPress={() => router.push({ pathname: "/property-edit", params: { id: p.id } })} hitSlop={8}>
                        <Text style={actionLabel(colors.slate, false)}>Edit</Text>
                      </Pressable>
                    )}
                    <Pressable onPress={() => router.push({ pathname: "/timer", params: { property: p.id } })} hitSlop={8}>
                      <Text style={actionLabel(colors.plum, true)}>Start timer</Text>
                    </Pressable>
                    <Pressable onPress={() => router.push("/log")} hitSlop={8}>
                      <Text style={actionLabel(colors.plum, true)}>Log hours</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TagPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: space(3.5),
        paddingVertical: space(2),
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? colors.plum : colors.chalk,
        backgroundColor: active ? colors.plum : colors.cream,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: "500", color: active ? colors.cream : colors.quill }}>{label}</Text>
    </Pressable>
  );
}

// Mono uppercase action link; plum ones carry the web's tangerine underline.
const actionLabel = (color: string, underline: boolean): TextStyle => ({
  fontFamily: fonts.mono,
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase",
  color,
  ...(underline
    ? { textDecorationLine: "underline" as const, textDecorationColor: colors.tangerine }
    : {}),
});
