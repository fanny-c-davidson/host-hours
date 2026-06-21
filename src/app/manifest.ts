import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Host Hours",
    short_name: "Host Hours",
    description:
      "Track short-term-rental hosting hours, organize by property, and export tax reports.",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F9F6F0",
    theme_color: "#4A148C",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
