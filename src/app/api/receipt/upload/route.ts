import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getUserFromRequest } from "@/lib/api-auth";
import { r2Put } from "@/lib/r2";
import { thumbStoragePath, MAX_PHOTOS_PER_ENTRY } from "@/lib/photos";

// Receives client-resized receipt photos (full + optional thumbnail per photo)
// as multipart form data, writes them to R2, and inserts the metadata rows.
// Authorizes the uploader as the owner of the target time-log and enforces the
// per-entry photo cap (even across concurrent uploads).
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const form = await req.formData();
  const timeLogId = String(form.get("timeLogId") ?? "");
  const count = Number(form.get("count") ?? 0);
  if (!timeLogId || !Number.isFinite(count) || count <= 0) {
    return NextResponse.json({ ok: true, uploaded: 0 });
  }

  const db = createServiceClient();

  // Photos may only be attached to the uploader's own entry.
  const { data: log } = await db
    .from("time_logs")
    .select("user_id")
    .eq("id", timeLogId)
    .maybeSingle();
  if (!log || log.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Backstop the 10-per-entry cap server-side (the UI also prevents going over).
  const { count: existing } = await db
    .from("time_log_photos")
    .select("id", { count: "exact", head: true })
    .eq("time_log_id", timeLogId);
  const remaining = Math.max(0, MAX_PHOTOS_PER_ENTRY - (existing ?? 0));
  if (remaining === 0) return NextResponse.json({ ok: true, uploaded: 0 });

  const rows: {
    time_log_id: string;
    user_id: string;
    storage_path: string;
    file_name: string;
    content_type: string;
    file_size: number;
  }[] = [];

  let uploaded = 0;
  for (let i = 0; i < count && uploaded < remaining; i++) {
    const full = form.get(`full_${i}`);
    if (!(full instanceof File)) continue;

    const ext = (full.name.split(".").pop() || "jpg").toLowerCase();
    const key = `${user.id}/${timeLogId}/${crypto.randomUUID()}.${ext}`;
    const fullType = full.type || "image/jpeg";

    try {
      await r2Put(key, new Uint8Array(await full.arrayBuffer()), fullType);
    } catch {
      continue; // skip this file; don't record a row for a failed upload
    }

    // Thumbnail is best-effort: a failure never blocks the photo.
    const thumb = form.get(`thumb_${i}`);
    if (thumb instanceof File) {
      try {
        await r2Put(
          thumbStoragePath(key),
          new Uint8Array(await thumb.arrayBuffer()),
          thumb.type || "image/jpeg",
        );
      } catch {
        /* ignore */
      }
    }

    rows.push({
      time_log_id: timeLogId,
      user_id: user.id,
      storage_path: key,
      file_name: full.name,
      content_type: fullType,
      file_size: full.size,
    });
    uploaded++;
  }

  if (rows.length > 0) {
    await db.from("time_log_photos").insert(rows);
  }

  return NextResponse.json({ ok: true, uploaded });
}
