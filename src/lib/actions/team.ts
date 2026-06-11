"use server";

import { getAuthenticatedUser, UNAUTHORIZED } from "./_helpers";
import { createClient } from "@/lib/supabase/server";
import { sendInvitationEmail } from "@/lib/email";
import type { ActionResult } from "@/types/app";
import type { TeamRole } from "@/lib/permissions";

type InviteResult = { teamMemberId: string; invitationToken: string };

export async function inviteTeamMember(
  email: string,
  role: TeamRole,
  propertyIds: string[],
): Promise<ActionResult<InviteResult>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  if (email.toLowerCase() === user.email?.toLowerCase()) {
    return { data: null, error: "You cannot invite yourself" };
  }

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("team_members")
    .select("id")
    .eq("owner_id", user.id)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return { data: null, error: "This person is already on your team" };
  }

  if (role === "spouse") {
    const { data: existingSpouse } = await supabase
      .from("team_members")
      .select("id")
      .eq("owner_id", user.id)
      .eq("role", "spouse")
      .maybeSingle();

    if (existingSpouse) {
      return { data: null, error: "You can only have one spouse on your team" };
    }
  }

  const { data: member, error: memberErr } = await supabase
    .from("team_members")
    .insert({
      owner_id: user.id,
      email: email.toLowerCase(),
      role,
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
    await supabase.from("property_assignments").insert(assignments);
  }

  const { data: invitation, error: invErr } = await supabase
    .from("invitations")
    .insert({ team_member_id: member.id })
    .select("token")
    .single();

  if (invErr || !invitation) {
    return { data: null, error: invErr?.message ?? "Failed to create invitation" };
  }

  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  try {
    await sendInvitationEmail({
      to: email,
      ownerName: ownerProfile?.full_name || user.email || "A Host Hours user",
      role,
      token: invitation.token,
    });
  } catch {
    // Don't fail the invitation — the team member and token were created successfully
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
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  if (role === "spouse") {
    const { data: existingSpouse } = await supabase
      .from("team_members")
      .select("id")
      .eq("owner_id", user.id)
      .eq("role", "spouse")
      .neq("id", teamMemberId)
      .maybeSingle();

    if (existingSpouse) {
      return { data: null, error: "You can only have one spouse on your team" };
    }
  }

  const { error } = await supabase
    .from("team_members")
    .update({ role })
    .eq("id", teamMemberId)
    .eq("owner_id", user.id);

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

export async function updateTeamMemberEmail(
  teamMemberId: string,
  email: string,
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

  const { data: existing } = await supabase
    .from("team_members")
    .select("id")
    .eq("owner_id", user.id)
    .eq("email", normalized)
    .neq("id", teamMemberId)
    .maybeSingle();

  if (existing) {
    return { data: null, error: "This email is already on your team" };
  }

  const { error } = await supabase
    .from("team_members")
    .update({ email: normalized, member_id: null, status: "pending" })
    .eq("id", teamMemberId)
    .eq("owner_id", user.id);

  if (error) return { data: null, error: error.message };
  return { data: undefined, error: null };
}

export async function removeTeamMember(
  teamMemberId: string,
  keepHours: boolean = false,
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("team_members")
    .select("id, member_id")
    .eq("id", teamMemberId)
    .eq("owner_id", user.id)
    .single();

  if (!member) {
    return { data: null, error: "Team member not found" };
  }

  if (member.member_id && keepHours) {
    const { data: properties } = await supabase
      .from("properties")
      .select("id")
      .eq("user_id", user.id);

    const propertyIds = (properties ?? []).map((p) => p.id);

    if (propertyIds.length > 0) {
      await supabase
        .from("time_logs")
        .update({ user_id: user.id })
        .eq("user_id", member.member_id)
        .in("property_id", propertyIds);
    }
  }

  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", teamMemberId)
    .eq("owner_id", user.id);

  if (error) return { data: null, error: error.message };

  if (member.member_id) {
    await supabase
      .from("team_members")
      .delete()
      .eq("owner_id", member.member_id)
      .eq("member_id", user.id);
  }

  return { data: undefined, error: null };
}

export async function acceptInvitation(
  token: string,
): Promise<ActionResult<{ ownerId: string }>> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { data: invitation, error: fetchErr } = await supabase
    .from("invitations")
    .select("id, team_member_id, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();

  if (fetchErr || !invitation) {
    return { data: null, error: "Invalid invitation link" };
  }

  if (invitation.used_at) {
    return { data: null, error: "This invitation has already been used" };
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return { data: null, error: "This invitation has expired" };
  }

  const { data: member, error: memberErr } = await supabase
    .from("team_members")
    .select("id, owner_id, email")
    .eq("id", invitation.team_member_id)
    .single();

  if (memberErr || !member) {
    return { data: null, error: "Team membership not found" };
  }

  if (member.email !== user.email?.toLowerCase()) {
    return { data: null, error: "This invitation was sent to a different email address" };
  }

  const { error: updateMemberErr } = await supabase
    .from("team_members")
    .update({ member_id: user.id, status: "active", joined_at: new Date().toISOString() })
    .eq("id", member.id);

  if (updateMemberErr) {
    return { data: null, error: updateMemberErr.message };
  }

  await supabase
    .from("invitations")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return { data: { ownerId: member.owner_id }, error: null };
}

export async function updatePropertyAssignments(
  teamMemberId: string,
  propertyIds: string[],
): Promise<ActionResult> {
  const user = await getAuthenticatedUser();
  if (!user) return UNAUTHORIZED;

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("team_members")
    .select("id")
    .eq("id", teamMemberId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!member) {
    return { data: null, error: "Team member not found" };
  }

  await supabase
    .from("property_assignments")
    .delete()
    .eq("team_member_id", teamMemberId);

  if (propertyIds.length > 0) {
    const assignments = propertyIds.map((property_id) => ({
      team_member_id: teamMemberId,
      property_id,
    }));
    const { error } = await supabase
      .from("property_assignments")
      .insert(assignments);
    if (error) return { data: null, error: error.message };
  }

  return { data: undefined, error: null };
}
