import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { r2GetBytes, r2Delete } from "@/lib/r2";
import { thumbStoragePath } from "@/lib/photos";

// Serves a receipt/photo through a STABLE, cacheable URL (vs. per-request signed
// URLs that bust the browser cache). The object is immutable (UUID key), so we
// let the browser cache it for a day — repeat views don't re-fetch from storage.
// R2 egress is free, so re-serving is also free. `?thumb=1` serves the small
// thumbnail variant (falls back to full if absent).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const wantThumb = req.nextUrl.searchParams.get("thumb") === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const db = createServiceClient();

  const { data: photo } = await db
    .from("time_log_photos")
    .select("storage_path, content_type, time_log_id")
    .eq("id", id)
    .maybeSingle();
  if (!photo) return new NextResponse("Not found", { status: 404 });

  // These thumbnails are only ever shown for a user's OWN entries, so only the
  // owner of the underlying time-log may fetch the image. (The combined tax PDF
  // inlines spouse photos server-side via getEntryPhotos, not this route.)
  const { data: log } = await db
    .from("time_logs")
    .select("user_id")
    .eq("id", photo.time_log_id)
    .maybeSingle();
  if (!log || log.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Prefer the thumbnail variant when asked; fall back to the full image
  // (older photos / non-images predate or skip thumbnails).
  let got: { bytes: Uint8Array; contentType?: string } | null = null;
  if (wantThumb) got = await r2GetBytes(thumbStoragePath(photo.storage_path));
  if (!got) got = await r2GetBytes(photo.storage_path);
  if (!got) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Blob([new Uint8Array(got.bytes)]), {
    headers: {
      "Content-Type": got.contentType || photo.content_type || "image/jpeg",
      "Cache-Control": "private, max-age=86400, immutable",
    },
  });
}

// Delete a photo: removes both R2 objects (full + thumbnail) and the metadata
// row. Only the photo's owner may delete it.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const db = createServiceClient();

  const { data: photo } = await db
    .from("time_log_photos")
    .select("storage_path, user_id")
    .eq("id", id)
    .maybeSingle();
  if (!photo) return new NextResponse(null, { status: 204 });
  if (photo.user_id !== user.id) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  await Promise.all([
    r2Delete([photo.storage_path, thumbStoragePath(photo.storage_path)]),
    db.from("time_log_photos").delete().eq("id", id),
  ]);

  return new NextResponse(null, { status: 204 });
}
