import { Text, View, type ViewStyle } from "react-native";
import { colors, fonts, radius, space } from "@/theme/tokens";

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          borderWidth: 1.5,
          borderColor: colors.chalk,
          borderRadius: radius.md,
          backgroundColor: colors.cream,
          padding: space(5),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine, marginBottom: space(2) }}>
      {children}
    </Text>
  );
}

export function MetricLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.mono, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: colors.slate, marginBottom: space(1) }}>
      {children}
    </Text>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const reached = clamped >= 100;
  return (
    <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.vellum, overflow: "hidden" }}>
      <View
        style={{
          width: `${clamped}%`,
          height: "100%",
          borderRadius: radius.pill,
          backgroundColor: reached ? colors.success : colors.plum,
        }}
      />
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <Text style={{ fontFamily: fonts.serifRegular, fontStyle: "italic", fontSize: 14, color: colors.slate, paddingVertical: space(4) }}>
      {message}
    </Text>
  );
}
