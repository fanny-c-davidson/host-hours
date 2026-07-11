import { supabase } from "./supabase";

// Base URL of the web app, which hosts the API routes mobile shares
// (receipt upload/delete, email-report).
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://host-hours.vercel.app";

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
    const res = await fetch(`${API_URL}/api/email-report`, {
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
    return { error: e?.message ?? "Send failed" };
  }
}
