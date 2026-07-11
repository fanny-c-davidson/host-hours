import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import {
  acceptInvitation,
  getInvitationInfo,
  signUpFromInvitation,
  type InvitationInfo,
} from "@/lib/team-api";
import { MetricLabel, SectionLabel } from "@/components/app-ui";
import { colors, fonts, radius, space } from "@/theme/tokens";

// Accept a team invitation. Reached by the hosthours://invite?token=… deep
// link, or by pasting the invite link from the email. Works signed-in (accept
// directly) and signed-out (create the account from the invitation, then
// sign in and accept).
export default function InviteScreen() {
  const router = useRouter();
  const { session, signIn, signOut } = useAuth();
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(params.token ?? "");
  const [pasted, setPasted] = useState("");
  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mismatch, setMismatch] = useState<{ invited: string; current: string | null } | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoadingInfo(true);
    getInvitationInfo(token)
      .then((res) => {
        if (!res.data) {
          setError("This invitation link is invalid or has been replaced. Ask your team owner to resend it.");
        } else {
          setInfo(res.data);
          setFirstName(res.data.firstName ?? "");
          setLastName(res.data.lastName ?? "");
          setError(null);
        }
      })
      .catch(() => setError("Could not load the invitation. Check your connection and try again."))
      .finally(() => setLoadingInfo(false));
  }, [token]);

  function handlePaste() {
    // Accept a full invite URL or a bare token.
    const match = pasted.match(/token=([a-zA-Z0-9-]+)/);
    const t = match?.[1] ?? pasted.trim();
    if (!t) return setError("Paste the invitation link from your email.");
    setError(null);
    setToken(t);
  }

  async function handleAccept() {
    setError(null);
    setMismatch(null);
    setBusy(true);
    try {
      const res = await acceptInvitation(token);
      setBusy(false);
      if (res.status === "success") {
        router.replace("/dashboard");
      } else if (res.status === "email-mismatch") {
        setMismatch({ invited: res.invitedEmail, current: res.currentEmail });
      } else {
        setError(res.message);
      }
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not accept the invitation.");
    }
  }

  async function handleSignUpAndAccept() {
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    setBusy(true);
    try {
      const res = await signUpFromInvitation({
        token,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        password,
      });
      if (res.error || !res.data) {
        setBusy(false);
        return setError(res.error ?? "Could not create the account.");
      }
      const { error: signInErr } = await signIn(res.data.email, password);
      if (signInErr) {
        setBusy(false);
        return setError(signInErr);
      }
      const accept = await acceptInvitation(token);
      setBusy(false);
      if (accept.status === "success") {
        router.replace("/dashboard");
      } else if (accept.status === "error") {
        setError(accept.message);
      } else {
        router.replace("/dashboard");
      }
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Could not create the account.");
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.cream }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: space(7), paddingBottom: space(12) }} keyboardShouldPersistTaps="handled">
        <SectionLabel>Invitation</SectionLabel>
        <Text style={{ fontFamily: fonts.serif, fontSize: 28, color: colors.plum, marginBottom: space(6) }}>
          {info?.ownerName ? `Join ${info.ownerName}'s team.` : "Join a team."}
        </Text>

        {error && (
          <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
            <Text style={{ color: colors.tangerine, fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {!token && (
          <>
            <MetricLabel>Invitation link</MetricLabel>
            <TextInput
              value={pasted}
              onChangeText={setPasted}
              placeholder="Paste the link from your email"
              placeholderTextColor={colors.stone}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <Pressable onPress={handlePaste} style={primaryBtn}>
              <Text style={primaryBtnLabel}>Continue</Text>
            </Pressable>
          </>
        )}

        {token && loadingInfo && <ActivityIndicator color={colors.plum} style={{ marginTop: space(6) }} />}

        {token && info && (
          <>
            <Text style={{ fontSize: 14, color: colors.char, marginBottom: space(5), lineHeight: 20 }}>
              This invitation was sent to{" "}
              <Text style={{ fontWeight: "600" }}>{info.email}</Text>.
            </Text>

            {mismatch && (
              <View style={{ marginBottom: space(4), padding: space(3), borderRadius: radius.md, backgroundColor: colors.tangerineGlow }}>
                <Text style={{ color: colors.tangerine, fontSize: 13, lineHeight: 18 }}>
                  You're signed in as {mismatch.current ?? "another account"}, but the
                  invitation is for {mismatch.invited}. Sign out and try again with the
                  invited account.
                </Text>
                <Pressable onPress={() => signOut()} style={{ marginTop: space(3) }}>
                  <Text style={{ color: colors.plum, fontSize: 13, textDecorationLine: "underline" }}>Sign out</Text>
                </Pressable>
              </View>
            )}

            {session ? (
              <Pressable onPress={handleAccept} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
                {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={primaryBtnLabel}>Accept invitation</Text>}
              </Pressable>
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: space(3) }}>
                  <View style={{ flex: 1 }}>
                    <MetricLabel>First name</MetricLabel>
                    <TextInput value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.stone} style={inputStyle} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <MetricLabel>Last name</MetricLabel>
                    <TextInput value={lastName} onChangeText={setLastName} placeholderTextColor={colors.stone} style={inputStyle} />
                  </View>
                </View>

                <View style={{ height: space(5) }} />
                <MetricLabel>Choose a password</MetricLabel>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="At least 8 characters"
                  placeholderTextColor={colors.stone}
                  style={inputStyle}
                />

                <Pressable onPress={handleSignUpAndAccept} disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
                  {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={primaryBtnLabel}>Create account & join</Text>}
                </Pressable>

                <Pressable onPress={() => router.push("/login")} style={{ marginTop: space(4), alignItems: "center" }}>
                  <Text style={{ fontSize: 13, color: colors.quill }}>
                    Already have an account?{" "}
                    <Text style={{ color: colors.plum, textDecorationLine: "underline" }}>Sign in</Text>, then open
                    this invite again.
                  </Text>
                </Pressable>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: space(4),
  borderWidth: 1,
  borderColor: colors.chalk,
  borderRadius: radius.md,
  fontSize: 15,
  color: colors.char,
} as const;

const primaryBtn = {
  marginTop: space(6),
  minHeight: 56,
  borderRadius: radius.md,
  backgroundColor: colors.plum,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const primaryBtnLabel = {
  color: colors.cream,
  fontSize: 15,
  fontWeight: "500" as const,
};
