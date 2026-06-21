import { ImageResponse } from "next/og";

// Generates the Host Hours app icon at a requested square size (used by the web
// manifest), so we don't need to commit binary PNGs. Plum field with the "HH"
// mark — full-bleed so it also works as a maskable/adaptive icon.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size } = await params;
  const dim = Math.min(1024, Math.max(48, Number(size) || 192));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4A148C",
          color: "#F9F6F0",
          fontSize: Math.round(dim * 0.42),
          fontWeight: 700,
        }}
      >
        HH
      </div>
    ),
    { width: dim, height: dim },
  );
}
