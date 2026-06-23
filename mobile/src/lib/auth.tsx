import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// Dismisses the auth popup automatically when the OAuth redirect returns.
WebBrowser.maybeCompleteAuthSession();

type AuthResult = { error: string | null };

type AuthState = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult & { needsConfirmation?: boolean }>;
  signInWithGoogle: () => Promise<AuthResult>;
  resetPassword: (email: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    session,
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signUp(email, password, fullName) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });
      if (error) return { error: error.message };
      // If the project requires email confirmation, no session is returned yet.
      return { error: null, needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      const redirectTo = Linking.createURL("auth/callback");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
      if (!data?.url) return { error: "Could not start Google sign-in." };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type !== "success") return { error: null }; // user dismissed

      const params = Linking.parse(result.url).queryParams ?? {};
      const code = typeof params.code === "string" ? params.code : null;
      if (!code) return { error: "Google sign-in did not return a code." };

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      return { error: exchangeError?.message ?? null };
    },
    async resetPassword(email) {
      const redirectTo = Linking.createURL("reset-password");
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
