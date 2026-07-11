import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getTimeLogPhotos, type TimeLogPhoto } from "@/lib/db";
import { deleteReceipt, pickReceipt, uploadReceipt } from "@/lib/photos";
import { colors, fonts, radius, space } from "@/theme/tokens";

const MAX_PHOTOS = 10;

// Attach/list/remove receipt photos for a saved entry (or group of entries).
// New photos attach to the first id; the list shows photos across all ids.
export function ReceiptAttach({ timeLogIds }: { timeLogIds: string[] }) {
  const [photos, setPhotos] = useState<TimeLogPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = timeLogIds.join(",");
  const load = useCallback(() => {
    getTimeLogPhotos(key.split(",")).then(setPhotos);
  }, [key]);

  useEffect(load, [load]);

  async function attach(source: "camera" | "library") {
    setError(null);
    const picked = await pickReceipt(source);
    if (!picked) return;
    setBusy(true);
    const { error: err } = await uploadReceipt(timeLogIds[0], picked);
    setBusy(false);
    if (err) return setError(err);
    load();
  }

  async function remove(photoId: string) {
    setError(null);
    setPhotos((cur) => cur.filter((p) => p.id !== photoId));
    const { error: err } = await deleteReceipt(photoId);
    if (err) {
      setError(err);
      load();
    }
  }

  const atCap = photos.length >= MAX_PHOTOS;

  return (
    <View>
      {photos.map((p) => (
        <View
          key={p.id}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: space(3),
            paddingVertical: space(2.5),
            borderWidth: 1,
            borderColor: colors.chalk,
            borderRadius: radius.md,
            marginBottom: space(2),
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space(2), flex: 1 }}>
            <Ionicons name="image-outline" size={16} color={colors.plum} />
            <Text style={{ fontSize: 13, color: colors.char, flex: 1 }} numberOfLines={1}>
              {p.file_name}
            </Text>
          </View>
          <Pressable onPress={() => remove(p.id)} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.stone} />
          </Pressable>
        </View>
      ))}

      {atCap ? (
        <Text style={{ fontSize: 11, color: colors.slate }}>
          Limit of {MAX_PHOTOS} photos per entry reached.
        </Text>
      ) : (
        <View style={{ flexDirection: "row", gap: space(3) }}>
          <Pressable onPress={() => attach("library")} disabled={busy} style={attachBtn}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.plum} />
            ) : (
              <>
                <Ionicons name="images-outline" size={14} color={colors.plum} />
                <Text style={attachLabel}>Gallery</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={() => attach("camera")} disabled={busy} style={attachBtn}>
            <Ionicons name="camera-outline" size={14} color={colors.plum} />
            <Text style={attachLabel}>Camera</Text>
          </Pressable>
        </View>
      )}

      {error && (
        <Text style={{ fontSize: 11, color: colors.tangerine, marginTop: space(2) }}>{error}</Text>
      )}
    </View>
  );
}

const attachBtn = {
  flex: 1,
  flexDirection: "row" as const,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  gap: space(2),
  borderWidth: 1,
  borderStyle: "dashed" as const,
  borderColor: colors.stone,
  borderRadius: radius.md,
  paddingVertical: space(3),
};

const attachLabel = {
  fontFamily: fonts.mono,
  fontSize: 10,
  letterSpacing: 1.5,
  textTransform: "uppercase" as const,
  color: colors.plum,
  fontWeight: "500" as const,
};
