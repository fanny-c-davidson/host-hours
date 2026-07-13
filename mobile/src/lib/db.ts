import { supabase } from "./supabase";

export type TeamRole = "owner" | "spouse" | "manager" | "employee";

export const canWriteProperties = (role: TeamRole) => role === "owner" || role === "spouse";
export const isStaff = (role: TeamRole) => role === "manager" || role === "employee";

export type Property = { id: string; name: string; color: string };

export type Profile = {
  full_name: string | null;
  email: string | null;
  tax_year: number | null;
  goal_hours: number | null;
  target_test: string | null;
};

export type ActiveTimer = {
  id: string;
  property_id: string;
  title: string;
  started_at: string;
  description: string | null;
};

export type LogEntry = {
  id: string;
  title: string;
  started_at: string;
  ended_at: string;
  duration_secs: number;
  description: string | null;
  is_onsite: boolean;
  property_id: string;
  propertyName: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email, tax_year, goal_hours, target_test")
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
    .select("id, title, started_at, ended_at, duration_secs, description, is_onsite, property_id, property:properties(name)")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    started_at: r.started_at,
    ended_at: r.ended_at,
    duration_secs: r.duration_secs,
    description: r.description ?? null,
    is_onsite: !!r.is_onsite,
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
    .select("id, property_id, title, started_at, description")
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
    .select("id, property_id, title, started_at, description")
    .single();
  return { data, error: error?.message ?? null };
}

/** Moves an active timer into time_logs via the server-side RPC. */
export async function stopTimer(
  timerId: string,
  userId: string,
): Promise<{ data: { id: string; duration_secs: number } | null; error: string | null }> {
  const { data, error } = await supabase
    .rpc("stop_timer", { p_timer_id: timerId, p_user_id: userId })
    .single();
  return { data: data as { id: string; duration_secs: number } | null, error: error?.message ?? null };
}

/** Fetch a single time_log by ID for the post-stop editor. */
export async function getTimeLog(logId: string) {
  const { data } = await supabase
    .from("time_logs")
    .select("id, title, started_at, ended_at, duration_secs, description, is_onsite, property_id, property:properties(name)")
    .eq("id", logId)
    .single();
  return data as {
    id: string;
    title: string;
    started_at: string;
    ended_at: string;
    duration_secs: number;
    description: string | null;
    is_onsite: boolean;
    property_id: string;
    property: { name: string } | null;
  } | null;
}

// ── Plans (mirrors web src/lib/constants.ts PLAN_LIMITS) ─────────────────────
export type PlanTier = "starter" | "pro" | "business";

const PLAN_MAX_PROPERTIES: Record<PlanTier, number> = {
  starter: 3,
  pro: Infinity,
  business: Infinity,
};

/**
 * Property cap for a tier. Unknown/legacy tiers (e.g. the signup trigger's
 * "free") get the starter cap — fail closed like the web's requirePropertySlot,
 * never open.
 */
export function maxPropertiesForTier(tier: string | null): number {
  return PLAN_MAX_PROPERTIES[(tier ?? "starter") as PlanTier] ?? PLAN_MAX_PROPERTIES.starter;
}

/** The caller's active tier id, or null if no active subscription. */
export async function getActiveTier(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();
  return data?.tier_id ?? null;
}

/** The caller's own active property count (same filters as web countActiveProperties). */
export async function countActiveProperties(userId: string): Promise<number> {
  const { count } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false)
    .is("deleted_at", null);
  return count ?? 0;
}

export async function updateProfileName(
  userId: string,
  fullName: string,
  email: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, email })
    .eq("id", userId);
  if (error) return { error: error.message };
  await supabase.auth.updateUser({ data: { full_name: fullName } });
  return { error: null };
}

export async function updateTaxSettings(
  userId: string,
  fields: { tax_year: number; target_test: string; goal_hours: number },
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("profiles").update(fields).eq("id", userId);
  return { error: error?.message ?? null };
}

export type TimeLogPhoto = { id: string; time_log_id: string; file_name: string };

/** Photos attached to any of the given time logs (RLS scopes to the caller). */
export async function getTimeLogPhotos(timeLogIds: string[]): Promise<TimeLogPhoto[]> {
  if (timeLogIds.length === 0) return [];
  const { data } = await supabase
    .from("time_log_photos")
    .select("id, time_log_id, file_name")
    .in("time_log_id", timeLogIds)
    .order("created_at", { ascending: true });
  return (data as TimeLogPhoto[] | null) ?? [];
}

/** Update a time_log's editable fields. */
export async function updateTimeLog(
  logId: string,
  fields: { description?: string | null; is_onsite?: boolean; started_at?: string; ended_at?: string },
): Promise<{ error: string | null }> {
  // duration_secs is a regular column (not generated — see migration 002), so
  // a time change must recompute it or the hours totals go stale.
  let payload: Record<string, unknown> = { ...fields };
  if (fields.started_at && fields.ended_at) {
    payload.duration_secs = Math.max(
      0,
      Math.floor((new Date(fields.ended_at).getTime() - new Date(fields.started_at).getTime()) / 1000),
    );
  }
  const { error } = await supabase.from("time_logs").update(payload).eq("id", logId);
  return { error: error?.message ?? null };
}

export type FilterProperty = { id: string; name: string; tags: string[] };

/** Properties with tags, for the reports filter pills. */
export async function getFilterProperties(): Promise<FilterProperty[]> {
  const { data } = await supabase
    .from("properties")
    .select("id, name, tags")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  return (data ?? []).map((p: any) => ({ id: p.id, name: p.name, tags: p.tags ?? [] }));
}

export type Cohost = { memberId: string; name: string };

/**
 * The caller's spouse co-owner, in either direction: the spouse on the
 * caller's team, or — if the caller is a spouse — the team's owner. Their
 * hours combine for the IRS material participation tests.
 */
export async function getCohost(userId: string): Promise<Cohost | null> {
  const { data: spouse } = await supabase
    .from("team_members")
    .select("member_id, email, first_name")
    .eq("owner_id", userId)
    .eq("role", "spouse")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (spouse?.member_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", spouse.member_id)
      .maybeSingle();
    const profileFirst = p?.full_name?.split(" ")[0];
    return { memberId: spouse.member_id, name: spouse.first_name || profileFirst || spouse.email };
  }

  const { data: mine } = await supabase
    .from("team_members")
    .select("owner_id")
    .eq("member_id", userId)
    .eq("role", "spouse")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (mine?.owner_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", mine.owner_id)
      .maybeSingle();
    return { memberId: mine.owner_id, name: p?.full_name?.split(" ")[0] || "Owner" };
  }

  return null;
}

/**
 * The team the caller manages: their own (as owner) or the one they belong to
 * (as spouse/manager/employee).
 */
export async function getMyTeamOwner(
  userId: string,
): Promise<{ ownerId: string; role: TeamRole }> {
  const { data } = await supabase
    .from("team_members")
    .select("owner_id, role")
    .eq("member_id", userId)
    .eq("status", "active")
    .neq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (data) return { ownerId: data.owner_id, role: data.role as TeamRole };
  return { ownerId: userId, role: "owner" };
}

/** Soft-delete time logs (sets deleted_at, like the web editor). */
export async function deleteTimeLogs(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  const { error } = await supabase
    .from("time_logs")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", ids);
  return { error: error?.message ?? null };
}

/** The caller's role on a team they belong to; "owner" if they're not a member. */
export async function getMyRole(userId: string): Promise<TeamRole> {
  const { data } = await supabase
    .from("team_members")
    .select("role")
    .eq("member_id", userId)
    .eq("status", "active")
    .neq("owner_id", userId) // a self-membership row must not demote the owner
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

/**
 * Every non-deleted log for the user. Pages through Supabase's per-request row
 * cap so the reports/export screens see the complete history — a truncated set
 * would silently produce a wrong CSV total.
 */
export async function getAllLogs(userId: string): Promise<LogEntry[]> {
  const PAGE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("time_logs")
      .select("id, title, started_at, ended_at, duration_secs, description, is_onsite, property_id, property:properties(name)")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("started_at", { ascending: false })
      .range(from, from + PAGE - 1);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows.map((r: any) => ({
    id: r.id,
    title: r.title,
    started_at: r.started_at,
    ended_at: r.ended_at,
    duration_secs: r.duration_secs,
    description: r.description ?? null,
    is_onsite: !!r.is_onsite,
    property_id: r.property_id,
    propertyName: r.property?.name ?? null,
  }));
}

export type TeamMember = {
  member_id: string | null;
  name: string;
  role: TeamRole;
  email: string;
  display_role: string | null;
};

export async function getTeamMembers(ownerId: string): Promise<TeamMember[]> {
  const { data } = await supabase
    .from("team_members")
    .select("member_id, role, email, first_name, last_name, display_role")
    .eq("owner_id", ownerId)
    .eq("status", "active");
  return (data ?? []).map((r: any) => ({
    member_id: r.member_id,
    role: r.role,
    email: r.email,
    display_role: r.display_role ?? null,
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

export type TaskType = { id: string; name: string; sort_order: number };

export async function getTaskTypes(): Promise<TaskType[]> {
  const { data } = await supabase
    .from("task_types")
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function createTaskType(
  userId: string,
  name: string,
  sortOrder: number,
): Promise<TaskType | null> {
  const { data } = await supabase
    .from("task_types")
    .insert({ user_id: userId, name, sort_order: sortOrder })
    .select("id, name, sort_order")
    .single();
  return data;
}

/** Get today's total logged seconds for a user. */
export async function getTodaySeconds(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("time_logs")
    .select("duration_secs")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("started_at", today.toISOString());
  return (data ?? []).reduce((sum, r) => sum + (r.duration_secs ?? 0), 0);
}

/** Update the description (notes) on an active timer. */
export async function updateActiveTimerDescription(
  timerId: string,
  description: string | null,
): Promise<void> {
  await supabase
    .from("active_timers")
    .update({ description })
    .eq("id", timerId);
}

export async function createProperty(
  userId: string,
  name: string,
  address: string,
  color: string,
  coords?: { latitude: number; longitude: number } | null,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("properties").insert({
    user_id: userId,
    name: name.trim(),
    address: address.trim() || null,
    color,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  });
  return { error: error?.message ?? null };
}

export type PropertyDetail = {
  id: string;
  name: string;
  address: string | null;
  color: string;
  tags: string[] | null;
  latitude: number | null;
  longitude: number | null;
};

export async function getPropertyDetail(id: string): Promise<PropertyDetail | null> {
  const { data } = await supabase
    .from("properties")
    .select("id, name, address, color, tags, latitude, longitude")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return (data as PropertyDetail | null) ?? null;
}

/** Every tag in use across the caller's visible properties (for suggestions). */
export async function getAllPropertyTags(): Promise<string[]> {
  const { data } = await supabase.from("properties").select("tags").is("deleted_at", null);
  const set = new Set<string>();
  (data ?? []).forEach((p: { tags: string[] | null }) => (p.tags ?? []).forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

/**
 * Update a property. An empty result means RLS matched no rows — the caller
 * isn't allowed to edit it (mirrors the web app's silent-failure guard).
 */
export async function updateProperty(
  id: string,
  fields: {
    name: string;
    address: string | null;
    color: string;
    tags: string[];
    latitude: number | null;
    longitude: number | null;
  },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.from("properties").update(fields).eq("id", id).select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "You don't have permission to edit this property." };
  return { error: null };
}

export async function softDeleteProperty(id: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase
    .from("properties")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "You don't have permission to delete this property." };
  return { error: null };
}
