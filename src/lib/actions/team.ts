"use server";

import { getAuthenticatedUser, UNAUTHORIZED } from "./_helpers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendInvitationEmail } from "@/lib/email";
import { r2GetBytes } from "@/lib/r2";
import { thumbStoragePath } from "@/lib/photos";
import type { ActionResult } from "@/types/app";
import { canManageMember, type TeamRole } from "@/lib/permissions";

async function resolveOwnerId(
  _supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  ownerId?: string,
): Promise<{ effectiveOwnerId: string | null; callerRole: TeamRole | null; error: string | null }> {
  if (!ownerId || ownerId === userId) {
    return { effectiveOwnerId: userId, callerRole: "owner", error: null };
  }
  // Authorize with the service-role client so this gate never depends on RLS.
  // The spouse SELECT policies on team_members have repeatedly caused silent
  // 0-row reads here, locking legitimate members out of team management. We're
  // checking a fully-qualified tuple (owner + this authenticated user + an
  // active managing role), so bypassing RLS for the read is safe.
  const db = createServiceClient();
  const { data: membership } = await db
    .from("team_members")
    .select("role")
    .eq("owner_id", ownerId)
    .eq("member_id", userId)
    .in("role", ["spouse", "manager"])
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return { effectiveOwnerId: null, callerRole: null, error: "You don't have permission to manage this team" };
  }
  return { effectiveOwnerId: ownerId, callerRole: membership.role as TeamRole, error: null };
}

// Managers may only act on managers and helpers — never the spouse or owner.
// Owners and spouses pass unconditionally. Returns an error string if the caller
// isn't allowed to manage the given target member, otherwise null.
async function guardTargetMember(
  db: ReturnType<typeof createServiceClient>,
  callerRole: TeamRole,
  effectiveOwnerId: string,
  teamMemberId: string,
): Promise<string | null> {
  if (callerRole !== "manager") return null;
  const { data: target } = await db
    .from("team_members")
    .select("role")
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId)
    .maybeSingle();
  if (!target) return "Team member not found";
  if (!canManageMember("manager", target.role as TeamRole)) {
    return "Managers can only manage other managers and helpers";
  }
  return null;
}

type InviteResult = { teamMemberId: string; invitationToken: string };

export async function inviteTeamMember(
  email: string,
  role: TeamRole,
  propertyIds: string[],
  firstName: string = "",
  lastName: string = "",
  displayRole: string = "",
  autoTimer: boolean = false,
  defaultTask: string = "",
  ownerId?: string,
): Promise<ActionResult<InviteResult>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return { data: null, error: "You cannot invite yourself" };
  }

  const supabase = await createClient();

  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  if (!canManageMember(callerRole, role)) {
    return { data: null, error: "Managers can only invite managers or helpers" };
  }

  // Authorized — create the member/assignments/invitation with the service-role
  // client (their RLS policies don't fully cover spouses, and the cross-table
  // invitations WITH CHECK doesn't hold for them).
  const db = createServiceClient();

  const { data: existing } = await db
    .from("team_members")
    .select("id")
    .eq("owner_id", effectiveOwnerId)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return { data: null, error: "This person is already on your team" };
  }

  if (role === "spouse") {
    const { data: existingSpouse } = await db
      .from("team_members")
      .select("id")
      .eq("owner_id", effectiveOwnerId)
      .eq("role", "spouse")
      .maybeSingle();

    if (existingSpouse) {
      return { data: null, error: "You can only have one spouse on your team" };
    }
  }

  const { data: member, error: memberErr } = await db
    .from("team_members")
    .insert({
      owner_id: effectiveOwnerId,
      email: email.toLowerCase(),
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
      role,
      // Spouses use a fixed label; only managers/helpers carry a custom name.
      display_role: role === "spouse" ? null : displayRole.trim() || null,
      auto_timer_enabled: autoTimer,
      default_task: defaultTask.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (memberErr || !member) {
    return { data: null, error: memberErr?.message ?? "Failed to create team member" };
  }

  if (propertyIds.length > 0) {
    const assignments = propertyIds.map((property_id) => ({
      team_member_id: member.id,
      property_id,
    }));
    await db.from("property_assignments").insert(assignments);
  }

  const { data: invitation, error: invErr } = await db
    .from("invitations")
    .insert({ team_member_id: member.id })
    .select("token")
    .single();

  if (invErr || !invitation) {
    return { data: null, error: invErr?.message ?? "Failed to create invitation" };
  }

  const { data: ownerProfile } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", effectiveOwnerId)
    .single();

  try {
    await sendInvitationEmail({
      to: email,
      ownerName: ownerProfile?.full_name || user.email || "A Host Hours user",
      role,
      token: invitation.token,
    });
  } catch {
    console.error("Invitation created but email delivery failed for", email);
  }

  return {
    data: { teamMemberId: member.id, invitationToken: invitation.token },
    error: null,
  };
}

export async function updateTeamMemberRole(
  teamMemberId: string,
  role: TeamRole,
  displayRole: string = "",
  ownerId?: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  // Authorized — manage the team with the service-role client (RLS doesn't
  // grant spouses the needed access, and the action enforces ownership above).
  const db = createServiceClient();

  const targetErr = await guardTargetMember(db, callerRole, effectiveOwnerId, teamMemberId);
  if (targetErr) return { data: null, error: targetErr };
  if (!canManageMember(callerRole, role)) {
    return { data: null, error: "Managers can only assign the manager or helper role" };
  }

  if (role === "spouse") {
    const { data: existingSpouse } = await db
      .from("team_members")
      .select("id")
      .eq("owner_id", effectiveOwnerId)
      .eq("role", "spouse")
      .neq("id", teamMemberId)
      .maybeSingle();

    if (existingSpouse) {
      return { data: null, error: "You can only have one spouse on your team" };
    }
  }

  const { error } = await db
    .from("team_members")
    .update({
      role,
      display_role: role === "spouse" ? null : displayRole.trim() || null,
    })
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId);

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

export async function updateTeamMemberName(
  teamMemberId: string,
  firstName: string,
  lastName: string,
  ownerId?: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();
  const targetErr = await guardTargetMember(db, callerRole, effectiveOwnerId, teamMemberId);
  if (targetErr) return { data: null, error: targetErr };

  const { error } = await db
    .from("team_members")
    .update({
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    })
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId);

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

export async function updateTeamMemberEmail(
  teamMemberId: string,
  email: string,
  ownerId?: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return { data: null, error: "Email is required" };
  }

  if (normalized === user.email?.toLowerCase()) {
    return { data: null, error: "You cannot use your own email" };
  }

  const supabase = await createClient();

  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();

  const targetErr = await guardTargetMember(db, callerRole, effectiveOwnerId, teamMemberId);
  if (targetErr) return { data: null, error: targetErr };

  const { data: existing } = await db
    .from("team_members")
    .select("id")
    .eq("owner_id", effectiveOwnerId)
    .eq("email", normalized)
    .neq("id", teamMemberId)
    .maybeSingle();

  if (existing) {
    return { data: null, error: "This email is already on your team" };
  }

  const { error } = await db
    .from("team_members")
    .update({ email: normalized, member_id: null, status: "pending" })
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId);

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

export async function removeTeamMember(
  teamMemberId: string,
  keepHours: boolean = false,
  ownerId?: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();

  const { data: member } = await db
    .from("team_members")
    .select("id, member_id, role")
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId)
    .single();

  if (!member) {
    return { data: null, error: "Team member not found" };
  }

  if (callerRole === "manager" && !canManageMember("manager", member.role as TeamRole)) {
    return { data: null, error: "Managers can only remove managers and helpers" };
  }

  if (member.member_id && keepHours) {
    const { data: properties } = await db
      .from("properties")
      .select("id")
      .eq("user_id", effectiveOwnerId);

    const propertyIds = (properties ?? []).map((p: { id: string }) => p.id);

    if (propertyIds.length > 0) {
      await db
        .from("time_logs")
        .update({ user_id: effectiveOwnerId })
        .eq("user_id", member.member_id)
        .in("property_id", propertyIds);
    }
  }

  const { error } = await db
    .from("team_members")
    .delete()
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId);

  if (error) return { data: null, error: error.message };

  if (member.member_id) {
    await db
      .from("team_members")
      .delete()
      .eq("owner_id", member.member_id)
      .eq("member_id", effectiveOwnerId);
  }

  return { data: undefined, error: null };
}

export async function transferOwnership(
  newOwnerId: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_team_ownership", {
    new_owner_id: newOwnerId,
  });

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

// Distinct result so the invite page can react specifically to a wrong-account
// (email-mismatch) sign-in versus a genuinely broken/expired link.
export type AcceptInvitationResult =
  | { status: "success"; ownerId: string }
  | { status: "email-mismatch"; invitedEmail: string; currentEmail: string | null }
  | { status: "error"; message: string };

export async function acceptInvitation(
  token: string,
): Promise<AcceptInvitationResult> {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { status: "error", message: "You must be signed in to accept an invitation." };
  }

  // The invitee has no RLS access to the pending invitation/team-member rows
  // until they accept (their member_id isn't set yet). Authorization here is:
  // a valid token + being signed in as the invited email. So read and write
  // with the service-role client and enforce that match in code.
  const db = createServiceClient();

  const { data: invitation, error: fetchErr } = await db
    .from("invitations")
    .select("id, team_member_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchErr || !invitation) {
    return {
      status: "error",
      message:
        "This invitation link is invalid or has been replaced. Ask your team owner to resend it.",
    };
  }

  const { data: member, error: memberErr } = await db
    .from("team_members")
    .select("id, owner_id, email, member_id")
    .eq("id", invitation.team_member_id)
    .single();

  if (memberErr || !member) {
    return { status: "error", message: "Team membership not found." };
  }

  if (invitation.used_at) {
    // Already accepted. If the signed-in user is the member who joined, they're
    // already on the team — send them in rather than showing a scary error.
    if (member.member_id === user.id) {
      return { status: "success", ownerId: member.owner_id };
    }
    return { status: "error", message: "This invitation has already been used." };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return {
      status: "error",
      message: "This invitation has expired. Ask your team owner to resend it.",
    };
  }

  if (member.email !== user.email?.toLowerCase()) {
    return {
      status: "email-mismatch",
      invitedEmail: member.email,
      currentEmail: user.email ?? null,
    };
  }

  const { error: updateMemberErr } = await db
    .from("team_members")
    .update({ member_id: user.id, status: "active", joined_at: new Date().toISOString() })
    .eq("id", member.id);

  if (updateMemberErr) {
    return { status: "error", message: updateMemberErr.message };
  }

  await db
    .from("invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return { status: "success", ownerId: member.owner_id };
}

// Look up the invited email (and inviter name) for a token so the invite/auth
// screens can personalize and prefill. Possessing the token is the credential,
// so no session is required; an invalid/non-UUID token just returns null.
export async function getInvitationInfo(
  token: string,
): Promise<{
  email: string;
  firstName: string | null;
  lastName: string | null;
  ownerName: string | null;
} | null> {
  const db = createServiceClient();

  const { data: invitation } = await db
    .from("invitations")
    .select("team_member_id")
    .eq("token", token)
    .maybeSingle();
  if (!invitation) return null;

  const { data: member } = await db
    .from("team_members")
    .select("email, owner_id, first_name, last_name")
    .eq("id", invitation.team_member_id)
    .single();
  if (!member) return null;

  const { data: owner } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", member.owner_id)
    .maybeSingle();

  return {
    email: member.email,
    firstName: member.first_name ?? null,
    lastName: member.last_name ?? null,
    ownerName: owner?.full_name ?? null,
  };
}

// Create an account directly from an invitation, skipping email confirmation.
// The invite token was delivered to that inbox, which already proves the invitee
// controls the address — so we create the user pre-confirmed via the admin API.
// The email comes from the token (not the client), so it can't be spoofed.
export async function signUpFromInvitation(params: {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}): Promise<ActionResult<{ email: string }>> {
  const { token, firstName, lastName, password } = params;

  if (!password || password.length < 8) {
    return { data: null, error: "Password must be at least 8 characters." };
  }

  const db = createServiceClient();

  const { data: invitation } = await db
    .from("invitations")
    .select("team_member_id, used_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return { data: null, error: "This invitation link is invalid or has been replaced." };
  }
  if (invitation.used_at) {
    return { data: null, error: "This invitation has already been used." };
  }
  if (new Date(invitation.expires_at) < new Date()) {
    return {
      data: null,
      error: "This invitation has expired. Ask your team owner to resend it.",
    };
  }

  const { data: member } = await db
    .from("team_members")
    .select("email")
    .eq("id", invitation.team_member_id)
    .single();

  if (!member) {
    return { data: null, error: "Team membership not found." };
  }

  const email = member.email;
  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();

  const { error: createErr } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: firstName.trim() || null,
      last_name: lastName.trim() || null,
    },
  });

  if (createErr) {
    const exists = /registered|already|exists/i.test(createErr.message);
    return {
      data: null,
      error: exists
        ? "An account already exists for this email. Please sign in instead."
        : createErr.message,
    };
  }

  return { data: { email }, error: null };
}

// Regenerate a pending member's invitation (fresh token) and re-send the email.
export async function resendInvitation(
  teamMemberId: string,
  ownerId?: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();
  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();

  const { data: member } = await db
    .from("team_members")
    .select("id, email, role, status")
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId)
    .single();

  if (!member) return { data: null, error: "Team member not found" };
  if (callerRole === "manager" && !canManageMember("manager", member.role as TeamRole)) {
    return { data: null, error: "Managers can only manage managers and helpers" };
  }
  if (member.status === "active") {
    return { data: null, error: "This member has already accepted." };
  }

  // Replace any existing invitation so the new link is the only valid one.
  await db.from("invitations").delete().eq("team_member_id", teamMemberId);
  const { data: invitation, error: invErr } = await db
    .from("invitations")
    .insert({ team_member_id: teamMemberId })
    .select("token")
    .single();

  if (invErr || !invitation) {
    return { data: null, error: invErr?.message ?? "Failed to create invitation" };
  }

  const { data: ownerProfile } = await db
    .from("profiles")
    .select("full_name")
    .eq("id", effectiveOwnerId)
    .single();

  try {
    await sendInvitationEmail({
      to: member.email,
      ownerName: ownerProfile?.full_name || "A Host Hours user",
      role: member.role,
      token: invitation.token,
    });
  } catch {
    console.error("Invitation regenerated but email delivery failed for", member.email);
  }

  return { data: undefined, error: null };
}

export async function updatePropertyAssignments(
  teamMemberId: string,
  propertyIds: string[],
  ownerId?: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  // Caller is authorized (resolveOwnerId) and the member belongs to this owner,
  // so read/write with the service-role client — the property_assignments RLS
  // doesn't grant DELETE to spouses, which would otherwise leave stale rows.
  const db = createServiceClient();

  const { data: member } = await db
    .from("team_members")
    .select("id, role")
    .eq("id", teamMemberId)
    .eq("owner_id", effectiveOwnerId)
    .maybeSingle();

  if (!member) {
    return { data: null, error: "Team member not found" };
  }

  if (callerRole === "manager" && !canManageMember("manager", member.role as TeamRole)) {
    return { data: null, error: "Managers can only manage managers and helpers" };
  }
  await db.from("property_assignments").delete().eq("team_member_id", teamMemberId);

  if (propertyIds.length > 0) {
    const assignments = propertyIds.map((property_id) => ({
      team_member_id: teamMemberId,
      property_id,
    }));
    const { error } = await db.from("property_assignments").insert(assignments);
    if (error) return { data: null, error: error.message };
  }

  return { data: undefined, error: null };
}

export type ManagedTeamMember = {
  id: string;
  email: string;
  role: TeamRole;
  status: string;
  member_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_role: string | null;
  memberName: string | null;
  propertyIds: string[];
};

export type ManagedTeamData = {
  callerRole: TeamRole;
  ownerName: string;
  ownerEmail: string;
  members: ManagedTeamMember[];
  properties: { id: string; name: string }[];
};

// Full team view for an authorized member (spouse or manager). Managers can't
// read the owner's roster under RLS, so this authorizes in code and reads with
// the service-role client — same pattern as the mutating actions.
export async function getManagedTeamData(
  ownerId: string,
): Promise<ActionResult<ManagedTeamData>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();
  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();

  const [{ data: ownerProfile }, { data: props }, { data: roster, error: rosterErr }] = await Promise.all([
    db.from("profiles").select("full_name, email").eq("id", effectiveOwnerId).single(),
    db.from("properties").select("id, name").eq("user_id", effectiveOwnerId).is("deleted_at", null).order("name"),
    db
      .from("team_members")
      .select("id, email, role, status, member_id, first_name, last_name, display_role")
      .eq("owner_id", effectiveOwnerId)
      .order("created_at", { ascending: true }),
  ]);

  // Fail loudly rather than silently returning an empty team (e.g. a missing
  // column would otherwise just make every member disappear).
  if (rosterErr) return { data: null, error: rosterErr.message };

  const roster2 = roster ?? [];
  const memberIds = roster2.map((t) => t.member_id).filter(Boolean) as string[];
  const teamMemberIds = roster2.map((t) => t.id);

  // Batch the per-member lookups into two queries instead of 2×N.
  const [{ data: profiles }, { data: assignments }] = await Promise.all([
    memberIds.length
      ? db.from("profiles").select("id, full_name").in("id", memberIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    teamMemberIds.length
      ? db.from("property_assignments").select("team_member_id, property_id").in("team_member_id", teamMemberIds)
      : Promise.resolve({ data: [] as { team_member_id: string; property_id: string }[] }),
  ]);

  const nameById = new Map((profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name]));
  const propsByMember = new Map<string, string[]>();
  for (const a of assignments ?? []) {
    const list = propsByMember.get(a.team_member_id) ?? [];
    list.push(a.property_id);
    propsByMember.set(a.team_member_id, list);
  }

  const members: ManagedTeamMember[] = roster2.map((tm) => ({
    id: tm.id,
    email: tm.email,
    role: tm.role as TeamRole,
    status: tm.status,
    member_id: tm.member_id,
    first_name: tm.first_name,
    last_name: tm.last_name,
    display_role: tm.display_role,
    memberName: tm.member_id ? nameById.get(tm.member_id) ?? null : null,
    propertyIds: propsByMember.get(tm.id) ?? [],
  }));

  return {
    data: {
      callerRole,
      ownerName: ownerProfile?.full_name ?? "",
      ownerEmail: ownerProfile?.email ?? "",
      members,
      properties: props ?? [],
    },
    error: null,
  };
}

// Logged seconds per user_id on the owner's properties, for the Team report
// tab. Authorized for an owner/spouse/manager; reads with the service-role
// client so it isn't limited by per-member RLS on time_logs (a spouse can't
// read a helper's/manager's logs, which made their team hours show as 0).
export async function getTeamHours(
  ownerId: string,
): Promise<ActionResult<Record<string, number>>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();
  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();

  const { data: props } = await db
    .from("properties")
    .select("id")
    .eq("user_id", effectiveOwnerId)
    .is("deleted_at", null);
  const propertyIds = (props ?? []).map((p: { id: string }) => p.id);
  if (propertyIds.length === 0) return { data: {}, error: null };

  const { data: logs } = await db
    .from("time_logs")
    .select("user_id, duration_secs")
    .in("property_id", propertyIds)
    .is("deleted_at", null);

  const seconds: Record<string, number> = {};
  for (const log of logs ?? []) {
    seconds[log.user_id] = (seconds[log.user_id] ?? 0) + (log.duration_secs ?? 0);
  }
  return { data: seconds, error: null };
}

// Receipt/photo image data URLs per time-log, for the tax report. Authorize the
// viewer in code (owner or active spouse/manager), then read the bytes from R2
// with server credentials — scoped to entries on the owner's properties — and
// inline them as base64 data URLs the PDF can embed directly. This lets a
// spouse/owner include each other's photos, which per-user storage access can't.
export async function getEntryPhotos(
  ownerId: string,
  entryIds: string[],
): Promise<ActionResult<Record<string, string[]>>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;
  if (entryIds.length === 0) return { data: {}, error: null };

  const supabase = await createClient();
  const { effectiveOwnerId, callerRole, error: ownerErr } = await resolveOwnerId(supabase, user.id, ownerId);
  if (!effectiveOwnerId || !callerRole) return { data: null, error: ownerErr! };

  const db = createServiceClient();

  // Restrict to entries logged on this owner's properties (the team's work).
  const { data: ownerProps } = await db
    .from("properties")
    .select("id")
    .eq("user_id", effectiveOwnerId)
    .is("deleted_at", null);
  const propertyIds = new Set((ownerProps ?? []).map((p: { id: string }) => p.id));

  const { data: logs } = await db
    .from("time_logs")
    .select("id, property_id")
    .in("id", entryIds);
  const allowedIds = (logs ?? [])
    .filter((l: { property_id: string }) => propertyIds.has(l.property_id))
    .map((l: { id: string }) => l.id);
  if (allowedIds.length === 0) return { data: {}, error: null };

  const { data: photoRows } = await db
    .from("time_log_photos")
    .select("storage_path, file_name, content_type, time_log_id")
    .in("time_log_id", allowedIds);
  const images = (photoRows ?? []).filter(
    (r: { content_type: string | null; file_name: string | null }) =>
      (r.content_type || "").startsWith("image/") ||
      /\.(jpe?g|png|gif|webp)$/i.test(r.file_name || ""),
  );
  if (images.length === 0) return { data: {}, error: null };

  // Read each image from R2 (prefer the smaller thumbnail; fall back to full)
  // and inline it as a base64 data URL.
  const byLog: Record<string, string[]> = {};
  await Promise.all(
    images.map(
      async (img: {
        storage_path: string;
        content_type: string | null;
        time_log_id: string;
      }) => {
        const thumb = await r2GetBytes(thumbStoragePath(img.storage_path));
        const got = thumb ?? (await r2GetBytes(img.storage_path));
        if (!got) return;
        const mime =
          got.contentType || (thumb ? "image/jpeg" : img.content_type) || "image/jpeg";
        const dataUrl = `data:${mime};base64,${Buffer.from(got.bytes).toString("base64")}`;
        (byLog[img.time_log_id] ??= []).push(dataUrl);
      },
    ),
  );
  return { data: byLog, error: null };
}

export type AutoTimerSettings = {
  autoTimerEnabled: boolean;
  defaultTask: string;
};

// A team member's own auto-timer settings (the value the native geofence engine
// will read). Read/write the caller's own membership rows only.
export async function getMyAutoTimer(): Promise<ActionResult<AutoTimerSettings | null>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const db = createServiceClient();
  const { data } = await db
    .from("team_members")
    .select("auto_timer_enabled, default_task")
    .eq("member_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!data) return { data: null, error: null };
  return {
    data: {
      autoTimerEnabled: !!data.auto_timer_enabled,
      defaultTask: data.default_task ?? "",
    },
    error: null,
  };
}

export async function updateMyAutoTimer(
  autoTimerEnabled: boolean,
  defaultTask: string,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  // Applies to all teams this person is on. They can only edit their own rows.
  const { error } = await createServiceClient()
    .from("team_members")
    .update({
      auto_timer_enabled: autoTimerEnabled,
      default_task: defaultTask.trim() || null,
    })
    .eq("member_id", user.id)
    .eq("status", "active");

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}
