import { NextRequest, NextResponse } from "next/server";
import {
  acceptInvitation,
  getInvitationInfo,
  getManagedTeamData,
  getTeamHours,
  inviteTeamMember,
  removeTeamMember,
  resendInvitation,
  signUpFromInvitation,
  updatePropertyAssignments,
  updateTeamMemberEmail,
  updateTeamMemberName,
  updateTeamMemberRole,
} from "@/lib/actions/team";
import type { TeamRole } from "@/lib/permissions";

// Mobile bridge to the team server actions. The web app calls these actions
// directly; mobile POSTs { action, ...params } here with a Bearer token, which
// getAuthenticatedUser() inside each action validates. Every action re-checks
// authorization itself (resolveOwnerId / role guards / invite tokens) — this
// route only maps params, it grants nothing.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : "");
  const strOrU = (k: string) => (typeof body[k] === "string" ? (body[k] as string) : undefined);
  const bool = (k: string) => body[k] === true;
  const strArr = (k: string) =>
    Array.isArray(body[k]) ? (body[k] as unknown[]).filter((x) => typeof x === "string") as string[] : [];

  try {
    switch (body.action) {
      // ── Authenticated management (each action authorizes the caller) ──
      case "managed-team-data":
        return NextResponse.json(await getManagedTeamData(str("ownerId")));
      case "team-hours":
        return NextResponse.json(await getTeamHours(str("ownerId")));
      case "invite":
        return NextResponse.json(
          await inviteTeamMember(
            str("email"),
            str("role") as TeamRole,
            strArr("propertyIds"),
            str("firstName"),
            str("lastName"),
            str("displayRole"),
            bool("autoTimer"),
            str("defaultTask"),
            strOrU("ownerId"),
          ),
        );
      case "update-role":
        return NextResponse.json(
          await updateTeamMemberRole(str("teamMemberId"), str("role") as TeamRole, str("displayRole"), strOrU("ownerId")),
        );
      case "update-name":
        return NextResponse.json(
          await updateTeamMemberName(str("teamMemberId"), str("firstName"), str("lastName"), strOrU("ownerId")),
        );
      case "update-email":
        return NextResponse.json(
          await updateTeamMemberEmail(str("teamMemberId"), str("email"), strOrU("ownerId")),
        );
      case "update-assignments":
        return NextResponse.json(
          await updatePropertyAssignments(str("teamMemberId"), strArr("propertyIds"), strOrU("ownerId")),
        );
      case "remove":
        return NextResponse.json(
          await removeTeamMember(str("teamMemberId"), bool("keepHours"), strOrU("ownerId")),
        );
      case "resend":
        return NextResponse.json(await resendInvitation(str("teamMemberId"), strOrU("ownerId")));

      // ── Invitation flow (the token itself is the credential) ──
      case "invitation-info":
        return NextResponse.json({ data: await getInvitationInfo(str("token")), error: null });
      case "accept-invitation":
        return NextResponse.json(await acceptInvitation(str("token")));
      case "sign-up-from-invitation":
        return NextResponse.json(
          await signUpFromInvitation({
            token: str("token"),
            firstName: str("firstName"),
            lastName: str("lastName"),
            password: str("password"),
          }),
        );

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    console.error("[api/team]", body.action, e);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
