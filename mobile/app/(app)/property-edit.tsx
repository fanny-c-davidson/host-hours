import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  canWriteProperties,
  getAllPropertyTags,
  getMyRole,
  getPropertyDetail,
  softDeleteProperty,
  updateProperty,
} from "@/lib/db";
import { AddressInput } from "@/components/address-input";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

const PRESET_COLORS = ["#4A148C", "#FF6B35", "#0F6E56", "#5F5E5A", "#1565C0", "#AD1457", "#F9A825", "#00695C"];

export default function EditPropertyScreen() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Owners/spouses only — bounce others out (matches web).
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      getMyRole(uid).then((role) => {
        if (!canWriteProperties(role)) router.replace("/properties");
      });
    }, [uid]),
  );

  useEffect(() => {
    if (!id) return;
    Promise.all([getPropertyDetail(id), getAllPropertyTags()]).then(([p, all]) => {
      setAllTags(all);
      if (!p) {
        setNotFound(true);
      } else {
        setName(p.name);
        setAddress(p.address ?? "");
        setLatitude(p.latitude);
        setLongitude(p.longitude);
        setColor(p.color || PRESET_COLORS[0]);
        setTags(p.tags ?? []);
      }
      setLoading(false);
    });
  }, [id]);

  function addTag(raw: string) {
    const t = raw.trim();
    setTagDraft("");
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) return setError("Property name is required.");
    setBusy(true);
    const { error: err } = await updateProperty(id!, {
      name: name.trim(),
      address: address.trim() || null,
      color,
      tags,
      latitude,
      longitude,
    });
    setBusy(false);
    if (err) return setError(err);
    router.replace("/properties");
  }

  async function handleDelete() {
    if (!confirmDelete) return setConfirmDelete(true);
    setDeleting(true);
    const { error: err } = await softDeleteProperty(id!);
    setDeleting(false);
    if (err) {
      setConfirmDelete(false);
      return setError(err);
    }
    router.replace("/properties");
  }

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.plum} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), marginBottom: space(2) }}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="chevron-back" size={20} color={colors.quill} />
          </Pressable>
          <SectionLabel>Edit property</SectionLabel>
        </View>

        {notFound ? (
          <Text style={{ fontFamily: fonts.serif, fontSize: 18, color: colors.quill, marginTop: space(8), textAlign: "center" }}>
            Property not found.
          </Text>
        ) : (
          <>
            <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>
              Update listing.
            </Text>

            {error && (
              <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
                <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
              </View>
            )}

            <MetricLabel>Name</MetricLabel>
            <TextInput value={name} onChangeText={setName} placeholder="Beach House" placeholderTextColor={colors.stone} style={inputStyle} />

            <View style={{ height: space(5) }} />
            <MetricLabel>Address</MetricLabel>
            <AddressInput
              value={address}
              onChange={setAddress}
              onSelect={(addr, lat, lng) => {
                setAddress(addr);
                setLatitude(lat);
                setLongitude(lng);
              }}
            />

            <View style={{ height: space(5) }} />
            <MetricLabel>Tags</MetricLabel>
            {tags.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), marginBottom: space(2) }}>
                {tags.map((t) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: space(1.5), paddingLeft: space(3), paddingRight: space(2), paddingVertical: space(1.5), borderRadius: radius.pill, backgroundColor: colors.plumMist }}>
                    <Text style={{ fontSize: 13, color: colors.plum }}>{t}</Text>
                    <Pressable onPress={() => setTags(tags.filter((x) => x !== t))} hitSlop={6}>
                      <Ionicons name="close" size={14} color={colors.plum} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <TextInput
              value={tagDraft}
              onChangeText={setTagDraft}
              onSubmitEditing={() => addTag(tagDraft)}
              onBlur={() => addTag(tagDraft)}
              placeholder="Add a tag…"
              placeholderTextColor={colors.stone}
              autoCapitalize="none"
              style={inputStyle}
            />
            {allTags.filter((t) => !tags.includes(t)).length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(2), marginTop: space(2) }}>
                {allTags
                  .filter((t) => !tags.includes(t))
                  .map((t) => (
                    <Pressable key={t} onPress={() => addTag(t)} style={{ paddingHorizontal: space(3), paddingVertical: space(1.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.chalk }}>
                      <Text style={{ fontSize: 13, color: colors.quill }}>{t}</Text>
                    </Pressable>
                  ))}
              </View>
            )}

            <View style={{ height: space(5) }} />
            <MetricLabel>Color</MetricLabel>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space(3) }}>
              {PRESET_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: colors.char }}
                />
              ))}
            </View>

            <Pressable
              onPress={handleSave}
              disabled={busy}
              style={{ marginTop: space(8), minHeight: 56, borderRadius: radius.md, backgroundColor: colors.plum, alignItems: "center", justifyContent: "center", opacity: busy ? 0.6 : 1 }}
            >
              {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>Save changes</Text>}
            </Pressable>

            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={{ marginTop: space(3), minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: confirmDelete ? colors.tangerine : colors.chalk, alignItems: "center", justifyContent: "center", opacity: deleting ? 0.6 : 1 }}
            >
              {deleting ? (
                <ActivityIndicator color={colors.tangerine} />
              ) : (
                <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine, fontWeight: "500" }}>
                  {confirmDelete ? "Tap again to confirm delete" : "Delete property"}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: space(4),
  borderWidth: 1,
  borderColor: colors.chalk,
  borderRadius: radius.md,
  fontSize: 15,
  color: colors.char,
} as const;
