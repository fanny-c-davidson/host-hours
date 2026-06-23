import { supabase } from "./supabase";

export type Property = { id: string; name: string; color: string };

export type Profile = {
  full_name: string | null;
  tax_year: number | null;
  goal_hours: number | null;
  target_test: string | null;
};

export type ActiveTimer = {
  id: string;
  property_id: string;
  title: string;
  started_at: string;
};

export type LogEntry = {
  id: string;
  title: string;
  started_at: string;
  duration_secs: number;
  property_id: string;
  propertyName: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, tax_year, goal_hours, target_test")
    .eq("id", userId)
    .single();
  return data;
}

/** Total logged seconds within a given tax year (Jan 1 – Dec 31). */
export async function getYearSeconds(userId: string, year: number): Promise<number> {
  const start = `${year}-01-01T00:00:00.000Z`;
  const end = `${year}-12-31T23:59:59.999Z`;
  const { data } = await supabase
    .from("time_logs")
    .select("duration_secs")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("started_at", start)
    .lte("started_at", end);
  return (data ?? []).reduce((sum, r) => sum + (r.duration_secs ?? 0), 0);
}

export async function getProperties(): Promise<Property[]> {
  const { data } = await supabase
    .from("properties")
    .select("id, name, color")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getRecentLogs(userId: string, limit = 5): Promise<LogEntry[]> {
  const { data } = await supabase
    .from("time_logs")
    .select("id, title, started_at, duration_secs, property_id, property:properties(name)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    started_at: r.started_at,
    duration_secs: r.duration_secs,
    property_id: r.property_id,
    propertyName: r.property?.name ?? null,
  }));
}

export async function getActiveTimer(userId: string): Promise<ActiveTimer | null> {
  const { data } = await supabase
    .from("active_timers")
    .select("id, property_id, title, started_at")
    .eq("user_id", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function startTimer(
  userId: string,
  propertyId: string,
  title: string,
): Promise<{ data: ActiveTimer | null; error: string | null }> {
  const { data, error } = await supabase
    .from("active_timers")
    .insert({ user_id: userId, property_id: propertyId, title: title.trim() || "Untitled" })
    .select("id, property_id, title, started_at")
    .single();
  return { data, error: error?.message ?? null };
}

/** Moves an active timer into time_logs via the server-side RPC. */
export async function stopTimer(timerId: string, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("stop_timer", { p_timer_id: timerId, p_user_id: userId });
  return { error: error?.message ?? null };
}
