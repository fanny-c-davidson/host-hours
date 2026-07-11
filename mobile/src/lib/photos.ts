import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

// The web app hosts the R2 upload endpoint; mobile posts to it with a Bearer
// token so receipts land in the same store the web reads from.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://host-hours.vercel.app";

export type PickedPhoto = { uri: string; name: string; type: string };

function toPhoto(res: ImagePicker.ImagePickerResult): PickedPhoto | null {
  if (res.canceled || !res.assets?.[0]) return null;
  const a = res.assets[0];
  return {
    uri: a.uri,
    name: a.fileName ?? `receipt-${Date.now()}.jpg`,
    type: a.mimeType ?? "image/jpeg",
  };
}

export async function pickReceipt(source: "camera" | "library"): Promise<PickedPhoto | null> {
  if (source === "camera") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    return toPhoto(await ImagePicker.launchCameraAsync({ quality: 0.6 }));
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  return toPhoto(await ImagePicker.launchImageLibraryAsync({ quality: 0.6 }));
}

/** Delete a photo (removes the R2 objects + metadata row via the web API). */
export async function deleteReceipt(photoId: string): Promise<{ error: string | null }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Not authenticated" };
  try {
    const res = await fetch(`${API_URL}/api/receipt/${photoId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { error: `Delete failed (${res.status})` };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? "Delete failed" };
  }
}

export async function uploadReceipt(
  timeLogId: string,
  photo: PickedPhoto,
): Promise<{ error: string | null }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Not authenticated" };

  const form = new FormData();
  form.append("timeLogId", timeLogId);
  form.append("count", "1");
  // React Native FormData accepts a {uri,name,type} file descriptor.
  form.append("full_0", { uri: photo.uri, name: photo.name, type: photo.type } as any);

  try {
    const res = await fetch(`${API_URL}/api/receipt/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return { error: `Upload failed (${res.status})` };
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? "Upload failed" };
  }
}
