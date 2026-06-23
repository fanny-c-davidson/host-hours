import { supabase } from "./supabase";

export type TeamRole = "owner" | "spouse" | "manager" | "employee";

export const canWriteProperties = (role: TeamRole) => role === "owner" || role === "spouse";
export const isStaff = (role: TeamRole) => role === "manager" || role === "employee";

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

export type GeoProperty = { id: string; latitude: number; longitude: number; radius: number };

/** Properties with coordinates, for geofencing. */
export async function getGeoProperties(): Promise<GeoProperty[]> {
  const { data } = await supabase
    .from("properties")
    .select("id, latitude, longitude, geo_radius_meters")
    .is("deleted_at", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  return (data ?? []).map((p: any) => ({
    id: p.id,
    latitude: p.latitude,
    longitude: p.longitude,
    radius: p.geo_radius_meters ?? 200,
  }));
}

export async function getActiveTimerByProperty(userId: string, propertyId: string): Promise<string | null> {
  const { data } = await supabase
    .from("active_timers")
    .select("id")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
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

/** The caller's role on a team they belong to; "owner" if they're not a member. */
export async function getMyRole(userId: string): Promise<TeamRole> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("member_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return (data?.role as TeamRole) ?? "owner";
}

/** Manual time entry: logs `hours` worth of time ending now. Returns the new id. */
export async function createLog(
  userId: string,
  propertyId: string,
  title: string,
  hours: number,
): Promise<{ id: string | null; error: string | null }> {
  const end = new Date();
  const start = new Date(end.getTime() - hours * 3600 * 1000);
  const { data, error } = await supabase
    .from("time_logs")
    .insert({
      user_id: userId,
      property_id: propertyId,
      title: title.trim() || "Untitled",
      started_at: start.toISOString(),
      ended_at: end.toISOString(),
      source: "manual",
    })
    .select("id")
    .single();
  return { id: data?.id ?? null, error: error?.message ?? null };
}

export async function getAllLogs(userId: string, limit = 100): Promise<LogEntry[]> {
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

export type TeamMember = {
  member_id: string | null;
  name: string;
  role: TeamRole;
  email: string;
};

export async function getTeamMembers(ownerId: string): Promise<TeamMember[]> {
  const { data } = await supabase
    .from("team_members")
    .select("member_id, role, email, first_name, last_name")
    .eq("owner_id", ownerId)
    .eq("status", "active");
  return (data ?? []).map((r: any) => ({
    member_id: r.member_id,
    role: r.role,
    email: r.email,
    name: [r.first_name, r.last_name].filter(Boolean).join(" ") || r.email,
  }));
}

export type AutoTimer = { enabled: boolean; defaultTask: string };

export async function getMyAutoTimer(userId: string, role: TeamRole): Promise<AutoTimer> {
  const table = role === "owner" ? "profiles" : "team_members";
  const match = role === "owner" ? { id: userId } : { member_id: userId, status: "active" };
  const { data } = await supabase
    .from(table)
    .select("auto_timer_enabled, default_task")
    .match(match)
    .limit(1)
    .maybeSingle();
  return { enabled: !!data?.auto_timer_enabled, defaultTask: data?.default_task ?? "" };
}

export async function setMyAutoTimer(enabled: boolean, defaultTask: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("set_my_auto_timer", { p_enabled: enabled, p_task: defaultTask });
  return { error: error?.message ?? null };
}

export async function createProperty(
  userId: string,
  name: string,
  address: string,
  color: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("properties").insert({
    user_id: userId,
    name: name.trim(),
    address: address.trim() || null,
    color,
  });
  return { error: error?.message ?? null };
}
