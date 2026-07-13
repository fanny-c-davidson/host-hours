import { supabase } from "./supabase";

// Base URL of the web app, which hosts the API routes mobile shares
// (receipt upload/delete, email-report, team bridge).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://host-hours.vercel.app";

/**
 * fetch against the web app with a hard timeout, rejecting login-page
 * redirects. Out-of-date server versions 307 API calls to /login; following
 * that redirect yields a 200 HTML page that must not read as success.
 */
export async function apiFetch(path: string, init: RequestInit, timeoutMs = 15_000): Promise<Response> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_URL}${path}`, { ...init, signal: abort.signal });
    if (res.url.includes("/login")) {
      throw new Error("The Host Hours server needs an update before this works from the app.");
    }
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** Email the activities CSV to the signed-in user (via the web app's Resend route). */
export async function emailCsvReport(
  csv: string,
  email: string,
  property: string,
): Promise<{ error: string | null }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { error: "Not authenticated" };
  try {
    const res = await apiFetch("/api/email-report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csv, email, property }),
    });
    if (!res.ok) return { error: `Send failed (${res.status})` };
    return { error: null };
  } catch (e: any) {
    return { error: e?.name === "AbortError" ? "Send timed out — check your connection." : e?.message ?? "Send failed" };
  }
}
