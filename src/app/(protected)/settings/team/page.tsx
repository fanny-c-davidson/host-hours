"use client";

import { useEffect, useState } from "react";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";
import { inviteTeamMember, updateTeamMemberRole, updateTeamMemberEmail, updateTeamMemberName, updatePropertyAssignments, removeTeamMember, resendInvitation, transferOwnership, getManagedTeamData } from "@/lib/actions/team";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, roleDisplayName, manageableRoles, canManageMember, type TeamRole } from "@/lib/permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TeamMember = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "active" | "suspended";
  member_id: string | null;
  first_name: string | null;
  last_name: string | null;
  display_role: string | null;
  memberName: string | null;
  propertyIds: string[];
};

type Property = {
  id: string;
  name: string;
};

const ALL_ROLES: TeamRole[] = ["spouse", "manager", "employee"];

export default function TeamSettingsPage() {
  const [userId, setUserId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamOwnerName, setTeamOwnerName] = useState("");
  const [teamOwnerEmail, setTeamOwnerEmail] = useState("");
  const [teamRole, setTeamRole] = useState<string | null>(null);
  const [teamOwnerId, setTeamOwnerId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("employee");
  const [inviteDisplayRole, setInviteDisplayRole] = useState("");
  const [inviteAutoTimer, setInviteAutoTimer] = useState(false);
  const [inviteDefaultTask, setInviteDefaultTask] = useState("");

  const [invitePropertyIds, setInvitePropertyIds] = useState<string[]>([]);
  const [inviteSaving, setInviteSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>("employee");
  const [editDisplayRole, setEditDisplayRole] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPropertyIds, setEditPropertyIds] = useState<string[]>([]);

  // The viewer's own team_member row (when viewing as spouse/manager), so they
  // can edit their own name from their own row (no self-remove — that's leaving).
  const [selfMember, setSelfMember] = useState<{ id: string; first_name: string | null; last_name: string | null } | null>(null);
  const [editingSelf, setEditingSelf] = useState(false);
  const [selfFirst, setSelfFirst] = useState("");
  const [selfLast, setSelfLast] = useState("");
  const [savingSelf, setSavingSelf] = useState(false);

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [keepHours, setKeepHours] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resentId, setResentId] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferring, setTransferring] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    setIsTeamMember(false);
    setTeamOwnerName("");
    setTeamOwnerEmail("");
    setTeamRole(null);
    setTeamOwnerId(null);
    setMembers([]);
    setProperties([]);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    setOwnerName(profile?.full_name || "");
    setOwnerEmail(profile?.email || user.email || "");

    const userEmail = (user.email || "").toLowerCase();

    // Always check membership first — determines if user is a spouse/member
    const { data: membership } = await supabase
      .from("team_members")
      .select("owner_id, role")
      .eq("member_id", user.id)
      .eq("status", "active")
      .neq("owner_id", user.id)
      .limit(1)
      .maybeSingle();

    if (membership) {
      setIsTeamMember(true);
      setTeamRole(membership.role);

      const { data: ownerProf } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", membership.owner_id)
        .single();
      setTeamOwnerName(ownerProf?.full_name || "");
      setTeamOwnerEmail(ownerProf?.email || "");

      // Spouses and managers manage the owner's team. Managers can't read the
      // roster under RLS, so fetch it through the service-role server action.
      if (membership.role === "spouse" || membership.role === "manager") {
        const result = await getManagedTeamData(membership.owner_id);
        if (result.error || !result.data) {
          setError(result.error || "Failed to load team.");
          setLoading(false);
          return;
        }

        setTeamOwnerId(membership.owner_id);
        setTeamOwnerName(result.data.ownerName);
        setTeamOwnerEmail(result.data.ownerEmail);
        setProperties(result.data.properties);

        const ownerTeamMembers: TeamMember[] = result.data.members
          // Keep the viewer's own row in the list (it's sorted into place by
          // role below); only the team owner is rendered separately.
          .filter((t) => t.member_id !== membership.owner_id)
          .map((tm) => {
            const nameParts = tm.memberName?.split(" ") ?? [];
            return {
              id: tm.id,
              email: tm.email,
              role: tm.role,
              status: tm.status as "pending" | "active" | "suspended",
              member_id: tm.member_id,
              first_name: tm.first_name || nameParts[0] || null,
              last_name: tm.last_name || nameParts.slice(1).join(" ") || null,
              display_role: tm.display_role,
              memberName: tm.memberName,
              propertyIds: tm.propertyIds,
            };
          });
        setMembers(ownerTeamMembers);
        setLoading(false);
        return;
      }
    }

    // Owner view — load own team
    const [{ data: teamData, error: teamErr }, { data: propsData }] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, email, role, status, member_id, first_name, last_name, display_role")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("properties")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ]);

    // Surface a real error instead of silently showing an empty team.
    if (teamErr) {
      setError(teamErr.message);
      setLoading(false);
      return;
    }

    setProperties(propsData ?? []);

    const filtered = (teamData ?? []).filter(
      (t) => t.member_id !== user.id && t.email.toLowerCase() !== userEmail
    );

    // Batch the per-member name + property-assignment lookups (was 2×N queries).
    const memberIds = filtered.map((t) => t.member_id).filter(Boolean) as string[];
    const tmIds = filtered.map((t) => t.id);
    const [{ data: profileRows }, { data: assignmentRows }] = await Promise.all([
      memberIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", memberIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      tmIds.length
        ? supabase.from("property_assignments").select("team_member_id, property_id").in("team_member_id", tmIds)
        : Promise.resolve({ data: [] as { team_member_id: string; property_id: string }[] }),
    ]);
    const nameById = new Map((profileRows ?? []).map((p) => [p.id, p.full_name]));
    const propsByMember = new Map<string, string[]>();
    for (const a of assignmentRows ?? []) {
      const list = propsByMember.get(a.team_member_id) ?? [];
      list.push(a.property_id);
      propsByMember.set(a.team_member_id, list);
    }

    const teamMembers: TeamMember[] = filtered.map((tm) => {
      const memberName = tm.member_id ? nameById.get(tm.member_id) ?? null : null;
      const nameParts = memberName?.split(" ") ?? [];
      return {
        ...tm,
        role: tm.role as TeamRole,
        status: tm.status as "pending" | "active" | "suspended",
        first_name: tm.first_name || nameParts[0] || null,
        last_name: tm.last_name || nameParts.slice(1).join(" ") || null,
        memberName,
        propertyIds: propsByMember.get(tm.id) ?? [],
      };
    });

    setMembers(teamMembers);
    setLoading(false);
  }

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (inviteRole !== "spouse" && invitePropertyIds.length === 0) {
      setError("Assign at least one property for this role.");
      return;
    }

    setInviteSaving(true);
    setError(null);

    const result = await inviteTeamMember(
      email,
      inviteRole,
      invitePropertyIds,
      inviteFirstName,
      inviteLastName,
      inviteDisplayRole,
      inviteAutoTimer,
      inviteDefaultTask,
      teamOwnerId || undefined,
    );
    if (result.error) {
      setError(result.error);
      setInviteSaving(false);
      return;
    }

    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteRole("employee");
    setInviteDisplayRole("");
    setInviteAutoTimer(false);
    setInviteDefaultTask("");
    setInvitePropertyIds([]);
    setShowInvite(false);
    setInviteSaving(false);
    loadTeam();
  }

  async function handleSaveEdit(member: TeamMember) {
    setError(null);
    const emailChanged = editEmail.trim().toLowerCase() !== member.email.toLowerCase();
    const roleChanged = editRole !== member.role;
    const displayRoleChanged =
      editRole !== "spouse" && editDisplayRole.trim() !== (member.display_role || "");
    const nameChanged = editFirstName.trim() !== (member.first_name || "") || editLastName.trim() !== (member.last_name || "");
    const propsChanged =
      editRole !== "spouse" &&
      ([...editPropertyIds].sort().join(",") !==
        [...member.propertyIds].sort().join(","));
    const ownerParam = teamOwnerId || undefined;

    if (emailChanged && !EMAIL_RE.test(editEmail.trim().toLowerCase())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (editRole !== "spouse" && editPropertyIds.length === 0) {
      setError("Assign at least one property for this role.");
      return;
    }

    if (nameChanged) {
      const result = await updateTeamMemberName(member.id, editFirstName, editLastName, ownerParam);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    if (emailChanged) {
      const result = await updateTeamMemberEmail(member.id, editEmail, ownerParam);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    if (roleChanged || displayRoleChanged) {
      const result = await updateTeamMemberRole(member.id, editRole, editDisplayRole, ownerParam);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    if (propsChanged) {
      const result = await updatePropertyAssignments(
        member.id,
        editPropertyIds,
        ownerParam,
      );
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    setEditingId(null);
    loadTeam();
  }

  async function handleSaveSelf() {
    if (!selfMember) return;
    setError(null);
    setSavingSelf(true);
    const result = await updateTeamMemberName(
      selfMember.id,
      selfFirst,
      selfLast,
      teamOwnerId || undefined,
    );
    setSavingSelf(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditingSelf(false);
    loadTeam();
  }

  function toggleEditProperty(propertyId: string) {
    setEditPropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId],
    );
  }

  async function handleResend(memberId: string) {
    setError(null);
    setResentId(null);
    setResendingId(memberId);
    const result = await resendInvitation(memberId, teamOwnerId || undefined);
    setResendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setResentId(memberId);
    setTimeout(
      () => setResentId((curr) => (curr === memberId ? null : curr)),
      2500,
    );
  }

  async function handleRemove(memberId: string) {
    setError(null);
    const result = await removeTeamMember(memberId, keepHours, teamOwnerId || undefined);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirmRemoveId(null);
    setKeepHours(true);
    loadTeam();
  }

  async function handleTransfer() {
    setTransferring(true);
    setError(null);
    const newOwnerId = teamOwnerId
      ? userId
      : members.find((m) => m.role === "spouse" && m.status === "active")?.member_id;
    if (!newOwnerId) return;
    const result = await transferOwnership(newOwnerId);
    if (result.error) {
      setError(result.error);
      setTransferring(false);
      return;
    }
    setShowTransferConfirm(false);
    setTransferring(false);
    loadTeam();
  }

  function toggleInviteProperty(propertyId: string) {
    setInvitePropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId],
    );
  }

  const viewerRole: TeamRole = isTeamMember ? ((teamRole as TeamRole) || "employee") : "owner";
  const hasSpouse = members.some((m) => m.role === "spouse") || teamRole === "spouse";
  // Roles this viewer may invite/assign — managers can't touch the spouse role.
  const baseManageRoles = manageableRoles(viewerRole);
  const inviteRoles = hasSpouse ? baseManageRoles.filter((r) => r !== "spouse") : baseManageRoles;
  // Whether the viewer may act on a member of the given role (hides edit/remove).
  const canActOn = (role: TeamRole) => canManageMember(viewerRole, role);
  // Display order: Spouse Co-Owner first, then Managers, then Helpers — each
  // group alphabetical by last name (the owner is rendered separately above).
  const ROLE_ORDER: Record<string, number> = { spouse: 0, manager: 1, employee: 2 };
  const sortedMembers = [...members].sort((a, b) => {
    const ra = ROLE_ORDER[a.role] ?? 9;
    const rb = ROLE_ORDER[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    const byLast = (a.last_name || "").toLowerCase().localeCompare((b.last_name || "").toLowerCase());
    if (byLast !== 0) return byLast;
    const byFirst = (a.first_name || "").toLowerCase().localeCompare((b.first_name || "").toLowerCase());
    if (byFirst !== 0) return byFirst;
    return a.email.localeCompare(b.email);
  });
  const spouseMember = members.find((m) => m.role === "spouse" && m.status === "active");
  // Only owners (→ spouse) and spouses (→ become owner) can transfer ownership.
  const canTransfer =
    (!isTeamMember && spouseMember?.member_id != null) ||
    (viewerRole === "spouse" && teamOwnerId != null);
  const transferTargetName = teamOwnerId ? ownerName : (spouseMember?.memberName || spouseMember?.email);
  const transferFromName = teamOwnerId ? teamOwnerName : ownerName;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <span className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-8">
      <TopStrip backHref="/settings" label="Team" />

      <header className="px-7 py-6 border-b border-chalk">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-tangerine font-medium">
          Team
        </p>
        <h1 className="mt-1 font-serif text-[36px] text-plum leading-tight">
          {isTeamMember ? `${teamOwnerName || "Team"}’s team.` : "Your team."}
        </h1>
        <p className="font-sans text-[13px] text-slate leading-relaxed mt-1">
          {isTeamMember
            ? `You’re a ${ROLE_LABELS[teamRole as TeamRole]?.toLowerCase() || "member"} on this team.`
            : "Invite your spouse, a manager, or an employee to track hours on your properties."}
        </p>
      </header>

      {error && (
        <div className="mx-7 mt-4 px-4 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
          <p className="text-[13px] text-tangerine">{error}</p>
        </div>
      )}

      {isTeamMember && !teamOwnerId ? (
        /* Read-only member view (helpers) — show the owner and the user's role */
        <div className="mt-4">
          <div className="px-7 py-5 border-b border-chalk">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-serif text-[17px] font-medium text-char tracking-[-0.2px]">
                  {teamOwnerName || teamOwnerEmail}
                </span>
              </div>
              {teamOwnerName && (
                <div className="text-[12px] text-slate mb-1">{teamOwnerEmail}</div>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-plum font-medium">
                  Owner
                </span>
              </div>
            </div>
          </div>
          <div className="px-7 py-5 border-b border-chalk">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-serif text-[17px] font-medium text-char tracking-[-0.2px]">
                  {ownerName || ownerEmail}
                </span>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[1px] font-medium bg-success/15 text-success">
                  active
                </span>
              </div>
              {ownerName && (
                <div className="text-[12px] text-slate mb-1">{ownerEmail}</div>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                <span className="font-mono text-[10px] uppercase tracking-[1px] text-plum font-medium">
                  {ROLE_LABELS[teamRole as TeamRole] || teamRole}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>

      {/* Owner + Team members list */}
      <div className="mt-4">
        {/* Owner row */}
        <div className="px-7 py-5 border-b border-chalk">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-serif text-[17px] font-medium text-char tracking-[-0.2px]">
                {teamOwnerId ? (teamOwnerName || teamOwnerEmail) : (ownerName || ownerEmail)}
              </span>
            </div>
            {(teamOwnerId ? teamOwnerName : ownerName) && (
              <div className="text-[12px] text-slate mb-1">
                {teamOwnerId ? teamOwnerEmail : ownerEmail}
              </div>
            )}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-[10px] uppercase tracking-[1px] text-plum font-medium">
                Owner
              </span>
            </div>
          </div>
        </div>
        {sortedMembers.map((m) => {
          const isSelf = m.member_id === userId;
          return (
            <div key={m.id} className="px-7 py-5 border-b border-chalk">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-serif text-[17px] font-medium text-char tracking-[-0.2px] truncate">
                      {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.memberName || m.email}
                    </span>
                    {isSelf && (
                      <span className="shrink-0 text-[12px] italic text-slate font-normal">(you)</span>
                    )}
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-[1px] font-medium ${
                        m.status === "active"
                          ? "bg-success/15 text-success"
                          : m.status === "pending"
                            ? "bg-tangerine/15 text-tangerine"
                            : "bg-stone/20 text-slate"
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  {(m.first_name || m.memberName) && (
                    <div className="text-[12px] text-slate mb-1">{m.email}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono text-[10px] uppercase tracking-[1px] text-plum font-medium">
                      {roleDisplayName(m.role, m.display_role)}
                    </span>
                    {m.role !== "spouse" && m.propertyIds.length > 0 && (
                      <span className="text-[11px] text-slate">
                        · {m.propertyIds.length} {m.propertyIds.length === 1 ? "property" : "properties"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isSelf ? (
                    // Your own row: edit your name only — no removing yourself.
                    !editingSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelfMember({ id: m.id, first_name: m.first_name, last_name: m.last_name });
                          setSelfFirst(m.first_name || "");
                          setSelfLast(m.last_name || "");
                          setEditingSelf(true);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[1px] text-slate hover:text-plum hover:bg-plum-mist transition-colors"
                      >
                        Edit
                      </button>
                    )
                  ) : (
                    canActOn(m.role) && editingId !== m.id && confirmRemoveId !== m.id && (
                    <>
                      {m.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleResend(m.id)}
                          disabled={resendingId === m.id}
                          className="min-h-[36px] px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[1px] text-plum hover:bg-plum-mist transition-colors disabled:opacity-50"
                        >
                          {resendingId === m.id
                            ? "Sending…"
                            : resentId === m.id
                              ? "Sent ✓"
                              : "Resend"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(m.id);
                          setEditRole(m.role);
                          setEditDisplayRole(m.display_role || "");
                          setEditEmail(m.email);
                          setEditFirstName(m.first_name || "");
                          setEditLastName(m.last_name || "");
                          setEditPropertyIds(m.propertyIds);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[1px] text-slate hover:text-plum hover:bg-plum-mist transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmRemoveId(m.id);
                          setKeepHours(true);
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-[1px] text-slate hover:text-tangerine transition-colors"
                      >
                        Remove
                      </button>
                    </>
                    )
                  )}
                </div>
              </div>

              {/* Your own row: name-only editor */}
              {isSelf && editingSelf && (
                <div className="mt-4 p-4 rounded-md border border-chalk bg-vellum">
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        First name
                      </label>
                      <input
                        type="text"
                        value={selfFirst}
                        onChange={(e) => setSelfFirst(e.target.value)}
                        placeholder="First"
                        className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        Last name
                      </label>
                      <input
                        type="text"
                        value={selfLast}
                        onChange={(e) => setSelfLast(e.target.value)}
                        placeholder="Last"
                        className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveSelf}
                      disabled={savingSelf}
                      className="min-h-10 px-4 py-2 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors disabled:opacity-50"
                    >
                      {savingSelf ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSelf(false)}
                      className="min-h-10 px-4 py-2 rounded-md text-[13px] text-quill hover:text-char transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Inline role editor */}
              {!isSelf && editingId === m.id && (
                <div className="mt-4 p-4 rounded-md border border-chalk bg-vellum">
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        First name
                      </label>
                      <input
                        type="text"
                        value={editFirstName}
                        onChange={(e) => setEditFirstName(e.target.value)}
                        placeholder="First"
                        className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        Last name
                      </label>
                      <input
                        type="text"
                        value={editLastName}
                        onChange={(e) => setEditLastName(e.target.value)}
                        placeholder="Last"
                        className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                      />
                    </div>
                  </div>

                  <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist mb-4"
                  />

                  <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                    Role
                  </label>
                  <div className="flex flex-col gap-2 mb-4">
                    {(m.role === "spouse" || !hasSpouse ? baseManageRoles : baseManageRoles.filter((r) => r !== "spouse")).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setEditRole(role)}
                        className={`text-left px-3.5 py-3 rounded-md border transition-colors ${
                          editRole === role
                            ? "border-plum bg-plum-mist"
                            : "border-chalk bg-cream hover:border-plum"
                        }`}
                      >
                        <span className="font-serif text-[14px] font-medium text-char block">
                          {ROLE_LABELS[role]}
                        </span>
                        <span className="text-[11px] text-slate leading-relaxed">
                          {ROLE_DESCRIPTIONS[role]}
                        </span>
                      </button>
                    ))}
                  </div>

                  {editRole !== "spouse" && (
                    <div className="mb-4">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        Role name
                      </label>
                      <input
                        type="text"
                        value={editDisplayRole}
                        onChange={(e) => setEditDisplayRole(e.target.value)}
                        placeholder={ROLE_LABELS[editRole]}
                        className="w-full min-h-11 px-4 py-3 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                      />
                      <p className="mt-1.5 text-[11px] text-slate">
                        Shown in the app, e.g. &ldquo;Cleaner.&rdquo; Defaults to {ROLE_LABELS[editRole]}.
                      </p>
                    </div>
                  )}

                  {editRole !== "spouse" && properties.length > 0 && (
                    <div className="mb-4">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        Assign properties <span className="text-tangerine">*</span>
                      </label>
                      <div className="flex flex-col gap-1.5">
                        {properties.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleEditProperty(p.id)}
                            className={`text-left px-3.5 py-2.5 rounded-md border transition-colors flex items-center gap-2.5 ${
                              editPropertyIds.includes(p.id)
                                ? "border-plum bg-plum-mist"
                                : "border-chalk bg-cream hover:border-plum"
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                                editPropertyIds.includes(p.id)
                                  ? "border-plum bg-plum"
                                  : "border-stone bg-cream"
                              }`}
                            >
                              {editPropertyIds.includes(p.id) && (
                                <svg className="w-2.5 h-2.5 text-cream" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="2 6 5 9 10 3" />
                                </svg>
                              )}
                            </span>
                            <span className="font-serif text-[14px] text-char">
                              {p.name}
                            </span>
                          </button>
                        ))}
                      </div>
                      {editPropertyIds.length === 0 && (
                        <p className="mt-1.5 text-[12px] text-tangerine">
                          Assign at least one property.
                        </p>
                      )}
                    </div>
                  )}

                  {editEmail.trim().toLowerCase() !== m.email.toLowerCase() && (
                    <div className="mb-4 px-3.5 py-3 rounded-md bg-tangerine/10 border border-tangerine/30">
                      <p className="text-[12px] text-tangerine leading-relaxed">
                        Changing the email will reset this member to pending. They&rsquo;ll need to accept a new invitation.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(m)}
                      disabled={
                        // invalid: email malformed, or a non-spouse with no property
                        !EMAIL_RE.test(editEmail.trim().toLowerCase()) ||
                        (editRole !== "spouse" && editPropertyIds.length === 0) ||
                        // unchanged
                        (editRole === m.role &&
                          editEmail.trim().toLowerCase() === m.email.toLowerCase() &&
                          editFirstName.trim() === (m.first_name || "") &&
                          editLastName.trim() === (m.last_name || "") &&
                          editDisplayRole.trim() === (m.display_role || "") &&
                          (editRole === "spouse" ||
                            [...editPropertyIds].sort().join(",") ===
                              [...m.propertyIds].sort().join(",")))
                      }
                      className="min-h-10 px-4 py-2 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="min-h-10 px-4 py-2 rounded-md text-[13px] text-quill hover:text-char transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Confirm remove */}
              {!isSelf && confirmRemoveId === m.id && (
                <div className="mt-4 p-4 rounded-md border border-tangerine/30 bg-tangerine/5">
                  <p className="font-serif text-[14px] text-char mb-3">
                    Remove <strong>{m.memberName || m.email}</strong> from your team?
                  </p>

                  {m.member_id && (
                    <div className="mb-4">
                      <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                        What about their logged hours?
                      </label>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => setKeepHours(true)}
                          className={`text-left px-3.5 py-3 rounded-md border transition-colors ${
                            keepHours
                              ? "border-plum bg-plum-mist"
                              : "border-chalk bg-cream hover:border-plum"
                          }`}
                        >
                          <span className="font-serif text-[14px] font-medium text-char block">
                            Keep their hours
                          </span>
                          <span className="text-[11px] text-slate leading-relaxed">
                            Hours will be transferred to your account and count toward your IRS totals.
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setKeepHours(false)}
                          className={`text-left px-3.5 py-3 rounded-md border transition-colors ${
                            !keepHours
                              ? "border-tangerine bg-tangerine/10"
                              : "border-chalk bg-cream hover:border-tangerine"
                          }`}
                        >
                          <span className="font-serif text-[14px] font-medium text-char block">
                            Discard their hours
                          </span>
                          <span className="text-[11px] text-slate leading-relaxed">
                            Their logged hours will no longer appear in your reports.
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemove(m.id)}
                      className="min-h-10 px-4 py-2 rounded-md text-[13px] font-medium bg-tangerine text-cream hover:bg-tangerine/90 transition-colors"
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveId(null)}
                      className="min-h-10 px-4 py-2 rounded-md text-[13px] text-quill hover:text-char transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Invite form */}
      {showInvite ? (
        <div className="mx-7 mt-6 p-5 rounded-md border border-chalk bg-vellum">
          <h3 className="font-serif text-[18px] font-medium text-plum mb-4">
            Invite team member
          </h3>

          {/* Name */}
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                First name
              </label>
              <input
                type="text"
                value={inviteFirstName}
                onChange={(e) => setInviteFirstName(e.target.value)}
                placeholder="First"
                className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
              />
            </div>
            <div className="flex-1">
              <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                Last name
              </label>
              <input
                type="text"
                value={inviteLastName}
                onChange={(e) => setInviteLastName(e.target.value)}
                placeholder="Last"
                className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
              />
            </div>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Email <span className="text-tangerine">*</span>
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="team@example.com"
              className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
            />
            {inviteEmail.trim() !== "" &&
              !EMAIL_RE.test(inviteEmail.trim().toLowerCase()) && (
                <p className="mt-1.5 text-[12px] text-tangerine">
                  Enter a valid email address.
                </p>
              )}
          </div>

          {/* Role */}
          <div className="mb-4">
            <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
              Role <span className="text-tangerine">*</span>
            </label>
            <div className="flex flex-col gap-2">
              {inviteRoles.map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setInviteRole(role)}
                  className={`text-left px-3.5 py-3 rounded-md border transition-colors ${
                    inviteRole === role
                      ? "border-plum bg-plum-mist"
                      : "border-chalk bg-cream hover:border-plum"
                  }`}
                >
                  <span className="font-serif text-[14px] font-medium text-char block">
                    {ROLE_LABELS[role]}
                  </span>
                  <span className="text-[11px] text-slate leading-relaxed">
                    {ROLE_DESCRIPTIONS[role]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Role name — custom display label for managers/helpers */}
          {inviteRole !== "spouse" && (
            <div className="mb-4">
              <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                Role name
              </label>
              <input
                type="text"
                value={inviteDisplayRole}
                onChange={(e) => setInviteDisplayRole(e.target.value)}
                placeholder={ROLE_LABELS[inviteRole]}
                className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
              />
              <p className="mt-1.5 text-[11px] text-slate">
                Shown in the app, e.g. &ldquo;Cleaner.&rdquo; Defaults to {ROLE_LABELS[inviteRole]}.
              </p>
            </div>
          )}

          {/* Property assignments (not for cohost — they get all) */}
          {inviteRole !== "spouse" && properties.length > 0 && (
            <div className="mb-5">
              <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                Assign properties <span className="text-tangerine">*</span>
              </label>
              <div className="flex flex-col gap-1.5">
                {properties.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleInviteProperty(p.id)}
                    className={`text-left px-3.5 py-2.5 rounded-md border transition-colors flex items-center gap-2.5 ${
                      invitePropertyIds.includes(p.id)
                        ? "border-plum bg-plum-mist"
                        : "border-chalk bg-cream hover:border-plum"
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                        invitePropertyIds.includes(p.id)
                          ? "border-plum bg-plum"
                          : "border-stone bg-cream"
                      }`}
                    >
                      {invitePropertyIds.includes(p.id) && (
                        <svg className="w-2.5 h-2.5 text-cream" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="2 6 5 9 10 3" />
                        </svg>
                      )}
                    </span>
                    <span className="font-serif text-[14px] text-char">
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
              {invitePropertyIds.length === 0 && (
                <p className="mt-1.5 text-[12px] text-tangerine">
                  Assign at least one property.
                </p>
              )}
            </div>
          )}

          {inviteRole === "spouse" && (
            <div className="mb-5 px-3.5 py-3 rounded-md bg-plum-mist border border-plum/20">
              <p className="text-[12px] text-plum leading-relaxed">
                Only legally married spouses can combine hours for IRS material participation tests. Your spouse will have full access to all your properties.
              </p>
            </div>
          )}

          {/* Auto-timer */}
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setInviteAutoTimer((v) => !v)}
              className={`w-full text-left px-3.5 py-3 rounded-md border transition-colors flex items-center justify-between gap-3 ${
                inviteAutoTimer ? "border-plum bg-plum-mist" : "border-chalk bg-cream hover:border-plum"
              }`}
            >
              <span className="min-w-0">
                <span className="font-serif text-[14px] font-medium text-char block">
                  Auto-timer
                </span>
                <span className="text-[11px] text-slate leading-relaxed">
                  Start the timer on arrival at a property and stop it on departure.
                </span>
              </span>
              <span
                className={`shrink-0 w-10 h-6 rounded-full relative transition-colors ${
                  inviteAutoTimer ? "bg-plum" : "bg-stone/40"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-cream transition-all ${
                    inviteAutoTimer ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>

            {inviteAutoTimer && (
              <div className="mt-3">
                <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                  Default task
                </label>
                <input
                  type="text"
                  value={inviteDefaultTask}
                  onChange={(e) => setInviteDefaultTask(e.target.value)}
                  placeholder="e.g. Cleaning"
                  className="w-full min-h-12 px-4 py-3.5 border border-chalk rounded-md text-[15px] text-char bg-cream focus:outline-none focus:border-plum focus:ring-2 focus:ring-plum-mist placeholder:text-stone"
                />
                <p className="mt-1.5 text-[11px] text-slate">
                  The task the auto-started timer logs.
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInvite}
              disabled={
                inviteSaving ||
                !EMAIL_RE.test(inviteEmail.trim().toLowerCase()) ||
                (inviteRole !== "spouse" && invitePropertyIds.length === 0)
              }
              className="min-h-11 px-5 py-2.5 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors disabled:opacity-50"
            >
              {inviteSaving ? "Sending..." : "Send invite"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInvite(false);
                setInviteEmail("");
                setInviteFirstName("");
                setInviteLastName("");
                setInviteRole("employee");
                setInviteDisplayRole("");
                setInviteAutoTimer(false);
                setInviteDefaultTask("");
                setInvitePropertyIds([]);
              }}
              className="min-h-11 px-4 py-2.5 rounded-md text-[13px] text-quill hover:text-char transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="px-7 mt-6">
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="w-full min-h-12 py-3 rounded-md text-center font-mono text-[11px] tracking-[1.5px] uppercase text-plum border border-plum hover:bg-plum hover:text-cream active:scale-[0.98] transition-all"
          >
            + Invite team member
          </button>
        </div>
      )}

      {/* Transfer ownership */}
      {canTransfer && (
        showTransferConfirm ? (
          <div className="mx-7 mt-6 p-5 rounded-md border border-tangerine/30 bg-tangerine/5">
            <h3 className="font-serif text-[18px] font-medium text-char mb-2">
              Transfer ownership?
            </h3>
            <div className="text-[13px] text-quill leading-relaxed space-y-1 mb-4">
              <p><strong>{transferTargetName}</strong> will become the team owner.</p>
              <p><strong>{transferFromName}</strong> will become a spouse.</p>
              <p>All properties will transfer to the new owner.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTransfer}
                disabled={transferring}
                className="min-h-10 px-4 py-2 rounded-md text-[13px] font-medium bg-tangerine text-cream hover:bg-tangerine/90 transition-colors disabled:opacity-50"
              >
                {transferring ? "Transferring..." : "Transfer"}
              </button>
              <button
                type="button"
                onClick={() => setShowTransferConfirm(false)}
                className="min-h-10 px-4 py-2 rounded-md text-[13px] text-quill hover:text-char transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="px-7 mt-4">
            <button
              type="button"
              onClick={() => setShowTransferConfirm(true)}
              className="w-full min-h-12 py-3 rounded-md text-center font-mono text-[11px] tracking-[1.5px] uppercase text-slate border border-chalk hover:border-tangerine hover:text-tangerine active:scale-[0.98] transition-all"
            >
              {teamOwnerId ? "Become team owner" : `Transfer ownership to ${spouseMember?.memberName || spouseMember?.email}`}
            </button>
          </div>
        )
      )}

      {/* Role legend */}
      <div className="mx-7 mt-8 p-5 rounded-md border border-chalk bg-vellum">
        <h3 className="font-mono text-[10px] tracking-[1.5px] uppercase text-slate font-medium mb-3">
          Role permissions
        </h3>
        {(["owner", ...ALL_ROLES] as TeamRole[]).map((role) => (
          <div key={role} className="mb-3 last:mb-0">
            <span className="font-serif text-[14px] font-medium text-char block">
              {ROLE_LABELS[role]}
            </span>
            <span className="text-[12px] text-slate leading-relaxed">
              {ROLE_DESCRIPTIONS[role]}
            </span>
          </div>
        ))}
      </div>

      </>
      )}
    </div>
  );
}
