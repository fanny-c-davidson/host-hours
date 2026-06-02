import type { SupabaseClient } from "@supabase/supabase-js";

export async function uploadPhotos(
  supabase: SupabaseClient,
  userId: string,
  timeLogId: string,
  photos: { file: File; preview: string }[],
) {
  const uploads = photos.map(async ({ file }) => {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/${timeLogId}/${crypto.randomUUID()}.${ext}`;

    const { error: storageError } = await supabase.storage
      .from("receipts")
      .upload(path, file, { contentType: file.type });

    if (storageError) return null;

    return {
      time_log_id: timeLogId,
      user_id: userId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type,
      file_size: file.size,
    };
  });

  const results = (await Promise.all(uploads)).filter(
    (r): r is NonNullable<typeof r> => r !== null,
  );

  if (results.length > 0) {
    await supabase.from("time_log_photos").insert(results);
  }
}

export async function deletePhoto(
  supabase: SupabaseClient,
  photoId: string,
  storagePath: string,
) {
  await Promise.all([
    supabase.storage.from("receipts").remove([storagePath]),
    supabase.from("time_log_photos").delete().eq("id", photoId),
  ]);
}

export async function getSignedUrls(
  supabase: SupabaseClient,
  photos: { id: string; storage_path: string; file_name: string }[],
) {
  if (photos.length === 0) return [];

  const { data } = await supabase.storage
    .from("receipts")
    .createSignedUrls(
      photos.map((p) => p.storage_path),
      3600,
    );

  return photos.map((photo, i) => ({
    id: photo.id,
    storagePath: photo.storage_path,
    fileName: photo.file_name,
    url: data?.[i]?.signedUrl ?? "",
  }));
}
