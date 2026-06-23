import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radius, space } from "@/theme/tokens";

/** Page shell: cream background, safe area, keyboard-aware, centered column. */
export function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: space(7),
            paddingVertical: space(10),
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: colors.tangerine, marginBottom: space(3) }}>
      {children}
    </Text>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.serif, fontSize: 38, lineHeight: 40, color: colors.plum, marginBottom: space(2) }}>
      {children}
    </Text>
  );
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontFamily: fonts.serifRegular, fontStyle: "italic", fontSize: 15, color: colors.quill, marginBottom: space(8) }}>
      {children}
    </Text>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
      <Text style={{ color: colors.tangerine, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export function Notice({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.successBg }}>
      <Text style={{ color: colors.success, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export function Field({ label, ...props }: { label: string } & TextInputProps) {
  return (
    <View style={{ marginBottom: space(5) }}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: colors.quill, marginBottom: space(2) }}>
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.stone}
        {...props}
        style={{
          minHeight: 48,
          paddingHorizontal: space(4),
          borderWidth: 1,
          borderColor: colors.chalk,
          borderRadius: radius.md,
          fontSize: 15,
          color: colors.char,
          backgroundColor: colors.cream,
        }}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        minHeight: 48,
        borderRadius: radius.md,
        backgroundColor: colors.plum,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled || loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.cream} />
      ) : (
        <Text style={{ color: colors.cream, fontSize: 15, fontWeight: "500" }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GhostButton({
  label,
  onPress,
  loading,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        minHeight: 48,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.chalk,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: space(3),
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={colors.plum} />
      ) : (
        <Text style={{ color: colors.plum, fontSize: 15, fontWeight: "500" }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <Text style={{ fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: colors.quill, textDecorationLine: "underline" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space(4), marginVertical: space(7) }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.chalk }} />
      <Text style={{ fontSize: 12, color: colors.slate }}>{label}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.chalk }} />
    </View>
  );
}
