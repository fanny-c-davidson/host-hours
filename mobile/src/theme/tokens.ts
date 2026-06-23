// Editorial design tokens, ported from the web app's globals.css so mobile and
// web share one visual language.

export const colors = {
  plum: "#4A148C",
  plumDeep: "#2E0B5C",
  plumHaze: "#6B3FAE",
  plumMist: "rgba(74, 20, 140, 0.06)",
  plumFog: "rgba(74, 20, 140, 0.12)",

  tangerine: "#FF6B35",
  tangerineGlow: "rgba(255, 107, 53, 0.16)",

  cream: "#FBF8F1",
  vellum: "#EDE5D4",

  char: "#2C2C2A",
  quill: "#5F5E5A",
  slate: "#888780",
  stone: "#B4B2A9",
  chalk: "#D3D1C7",

  success: "#0F6E56",
  successBg: "#DCEBE4",
} as const;

// Fraunces loaded via @expo-google-fonts/fraunces in the root layout; falls back
// to the platform serif until fonts finish loading.
export const fonts = {
  serif: "Fraunces_500Medium",
  serifRegular: "Fraunces_400Regular",
  // Geist isn't bundled yet — use the platform UI/mono faces for now.
  sans: "System",
  mono: "Courier",
} as const;

export const radius = { sm: 6, md: 10, pill: 999 } as const;
export const space = (n: number) => n * 4;
