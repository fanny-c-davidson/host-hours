-- Front-end display name for a team member, separate from the permission role.
-- e.g. a member with role 'employee' (Helper) can be shown as "Cleaner".
-- The `role` column remains the permission type. Spouses/owners use a fixed
-- label and ignore this; managers/helpers may set a custom name (NULL ⇒ fall
-- back to the role-type label).
alter table team_members
  add column if not exists display_role text;
