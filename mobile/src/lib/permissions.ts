import type { TeamRole } from "./db";

// Ported from web src/lib/permissions.ts — keep the two in sync.

// Which member roles a given actor is allowed to invite, edit, and remove.
// Owners and spouses manage the whole team; managers manage only managers and
// helpers (never the spouse or owner). Helpers manage no one.
export function manageableRoles(actorRole: TeamRole): TeamRole[] {
  if (actorRole === "owner" || actorRole === "spouse") return ["spouse", "manager", "employee"];
  if (actorRole === "manager") return ["manager", "employee"];
  return [];
}

export function canManageMember(actorRole: TeamRole, targetRole: TeamRole): boolean {
  return manageableRoles(actorRole).includes(targetRole);
}

export function canManageTeam(role: TeamRole): boolean {
  return manageableRoles(role).length > 0;
}

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  spouse: "Spouse Co-Owner",
  manager: "Manager",
  employee: "Helper",
};

// The label shown in the UI for a member. Owners and spouses always use the
// fixed role label; managers and helpers may carry a custom display name
// (e.g. "Cleaner") entered at invite/edit time, falling back to the type label.
export function roleDisplayName(role: TeamRole, custom?: string | null): string {
  if (role === "owner" || role === "spouse") return ROLE_LABELS[role];
  return custom?.trim() || ROLE_LABELS[role];
}

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: "Full access. Manages team, billing, and all properties.",
  spouse: "Legally married spouse. Hours combine for IRS material participation tests.",
  manager: "Can log hours and view reports for assigned properties.",
  employee: "Can log hours for assigned properties.",
};
