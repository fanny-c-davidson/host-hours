import { supabase } from "./supabase";
import { API_URL } from "./web-api";
import type { TeamRole } from "./db";

// Client for the web app's /api/team bridge. Team operations cross account
// boundaries (service-role on the server), so they can't go through RLS-bound
// Supabase queries like the rest of the mobile data layer.

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

export type InvitationInfo = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  ownerName: string | null;
};

export type AcceptInvitationResult =
  | { status: "success"; ownerId: string }
  | { status: "email-mismatch"; invitedEmail: string; currentEmail: string | null }
  | { status: "error"; message: string };

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  // Hard timeout: a hung request must fail, not freeze whichever screen
  // awaited it (e.g. old server versions redirected API POSTs into limbo).
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10_000);
  try {
    const res = await fetch(`${API_URL}/api/team`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

type Result<T = undefined> = { data: T | null; error: string | null };

export const getManagedTeamData = (ownerId: string) =>
  call<Result<ManagedTeamData>>({ action: "managed-team-data", ownerId });

export const getTeamHours = (ownerId: string) =>
  call<Result<Record<string, number>>>({ action: "team-hours", ownerId });

export const inviteTeamMember = (params: {
  email: string;
  role: TeamRole;
  propertyIds: string[];
  firstName: string;
  lastName: string;
  displayRole: string;
  ownerId?: string;
}) => call<Result<{ teamMemberId: string }>>({ action: "invite", ...params });

export const updateTeamMemberRole = (teamMemberId: string, role: TeamRole, displayRole: string, ownerId?: string) =>
  call<Result>({ action: "update-role", teamMemberId, role, displayRole, ownerId });

export const updateTeamMemberName = (teamMemberId: string, firstName: string, lastName: string, ownerId?: string) =>
  call<Result>({ action: "update-name", teamMemberId, firstName, lastName, ownerId });

export const updateTeamMemberEmail = (teamMemberId: string, email: string, ownerId?: string) =>
  call<Result>({ action: "update-email", teamMemberId, email, ownerId });

export const updatePropertyAssignments = (teamMemberId: string, propertyIds: string[], ownerId?: string) =>
  call<Result>({ action: "update-assignments", teamMemberId, propertyIds, ownerId });

export const removeTeamMember = (teamMemberId: string, keepHours: boolean, ownerId?: string) =>
  call<Result>({ action: "remove", teamMemberId, keepHours, ownerId });

export const resendInvitation = (teamMemberId: string, ownerId?: string) =>
  call<Result>({ action: "resend", teamMemberId, ownerId });

export const getInvitationInfo = (token: string) =>
  call<Result<InvitationInfo>>({ action: "invitation-info", token });

export const acceptInvitation = (token: string) =>
  call<AcceptInvitationResult>({ action: "accept-invitation", token });

export const signUpFromInvitation = (params: {
  token: string;
  firstName: string;
  lastName: string;
  password: string;
}) => call<Result<{ email: string }>>({ action: "sign-up-from-invitation", ...params });
