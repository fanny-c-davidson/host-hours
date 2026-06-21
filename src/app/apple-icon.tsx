import { ImageResponse } from "next/og";

// iOS home-screen icon (Next auto-links it as apple-touch-icon). iOS rounds the
// corners itself, so a full-bleed square is correct.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
          fontSize: 82,
          fontWeight: 700,
        }}
      >
        HH
      </div>
    ),
    { ...size },
  );
}
