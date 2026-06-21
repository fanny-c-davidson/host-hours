-- Phase 1: Team permissions system
-- Adds 'spouse' role, role_permissions table, and helper functions
-- for the team-based access control system replacing spouse_links.

-- ── Add 'spouse' to team_role enum ──────────────────────────

ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'spouse';

-- ── Role permissions table ──────────────────────────────────

CREATE TABLE role_permissions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role        team_role NOT NULL,
  permission  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read role permissions"
  ON role_permissions FOR SELECT USING (true);

-- Seed permissions for each role
INSERT INTO role_permissions (role, permission) VALUES
  -- spouse: full access, sees combined hours in reports (IRS material participation)
  ('spouse', 'properties.read'),
  ('spouse', 'properties.write'),
  ('spouse', 'time_logs.read'),
  ('spouse', 'time_logs.write'),
  ('spouse', 'reports.read'),
  ('spouse', 'reports.combined'),
  ('spouse', 'team.read'),
  -- manager: property-scoped access, can manage assigned employees
  ('manager', 'properties.read'),
  ('manager', 'time_logs.read'),
  ('manager', 'time_logs.write'),
  ('manager', 'reports.read'),
  ('manager', 'team.read'),
  -- employee: property-scoped, can only log own hours
  ('employee', 'time_logs.write'),
  ('employee', 'properties.read');

-- ── Helper functions ────────────────────────────────────────

-- Check if user is a team member of an owner
CREATE OR REPLACE FUNCTION is_team_member_of(p_owner_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE owner_id = p_owner_id
      AND member_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Get user's role on a specific owner's team
CREATE OR REPLACE FUNCTION get_team_role(p_owner_id uuid)
RETURNS team_role
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM team_members
  WHERE owner_id = p_owner_id
    AND member_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

-- Check if user has a specific permission on an owner's team
CREATE OR REPLACE FUNCTION has_team_permission(p_owner_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members tm
    JOIN role_permissions rp ON rp.role = tm.role
    WHERE tm.owner_id = p_owner_id
      AND tm.member_id = auth.uid()
      AND tm.status = 'active'
      AND rp.permission = p_permission
  );
$$;

-- Check if user is assigned to a specific property (via team)
CREATE OR REPLACE FUNCTION is_assigned_to_property(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM property_assignments pa
    JOIN team_members tm ON tm.id = pa.team_member_id
    WHERE pa.property_id = p_property_id
      AND tm.member_id = auth.uid()
      AND tm.status = 'active'
  );
$$;

-- ── Additional RLS: team members can view their own memberships ──

CREATE POLICY "Members can view own memberships"
  ON team_members FOR SELECT USING (auth.uid() = member_id);

-- ── Additional indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id);
CREATE INDEX IF NOT EXISTS idx_property_assignments_property ON property_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
