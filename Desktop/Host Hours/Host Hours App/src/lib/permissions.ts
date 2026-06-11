export type TeamRole = "owner" | "spouse" | "manager" | "employee";

export const PERMISSIONS = {
  PROPERTIES_READ: "properties.read",
  PROPERTIES_WRITE: "properties.write",
  TIME_LOGS_READ: "time_logs.read",
  TIME_LOGS_WRITE: "time_logs.write",
  REPORTS_READ: "reports.read",
  REPORTS_COMBINED: "reports.combined",
  TEAM_READ: "team.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
  owner: [
    PERMISSIONS.PROPERTIES_READ,
    PERMISSIONS.PROPERTIES_WRITE,
    PERMISSIONS.TIME_LOGS_READ,
    PERMISSIONS.TIME_LOGS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_COMBINED,
    PERMISSIONS.TEAM_READ,
  ],
  spouse: [
    PERMISSIONS.PROPERTIES_READ,
    PERMISSIONS.PROPERTIES_WRITE,
    PERMISSIONS.TIME_LOGS_READ,
    PERMISSIONS.TIME_LOGS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.REPORTS_COMBINED,
    PERMISSIONS.TEAM_READ,
  ],
  manager: [
    PERMISSIONS.PROPERTIES_READ,
    PERMISSIONS.TIME_LOGS_READ,
    PERMISSIONS.TIME_LOGS_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.TEAM_READ,
  ],
  employee: [
    PERMISSIONS.TIME_LOGS_WRITE,
    PERMISSIONS.PROPERTIES_READ,
  ],
};

export function hasPermission(role: TeamRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canViewCombinedReports(role: TeamRole): boolean {
  return hasPermission(role, PERMISSIONS.REPORTS_COMBINED);
}

export function canWriteProperties(role: TeamRole): boolean {
  return hasPermission(role, PERMISSIONS.PROPERTIES_WRITE);
}

export function canReadTimeLogs(role: TeamRole): boolean {
  return hasPermission(role, PERMISSIONS.TIME_LOGS_READ);
}

export function canManageTeam(role: TeamRole): boolean {
  return hasPermission(role, PERMISSIONS.TEAM_READ);
}

export const ROLE_LABELS: Record<TeamRole, string> = {
  owner: "Owner",
  spouse: "Spouse",
  manager: "Manager",
  employee: "Helper",
};

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  owner: "Full access. Manages team, billing, and all properties.",
  spouse: "Legally married spouse. Hours combine for IRS material participation tests.",
  manager: "Can log hours and view reports for assigned properties.",
  employee: "Can log hours for assigned properties.",
};
