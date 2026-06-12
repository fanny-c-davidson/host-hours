"use client";

import { useEffect, useState } from "react";
import { TopStrip } from "@/components/top-strip";
import { createClient } from "@/lib/supabase/client";
import { inviteTeamMember, updateTeamMemberRole, updateTeamMemberEmail, removeTeamMember } from "@/lib/actions/team";
import { ROLE_LABELS, ROLE_DESCRIPTIONS, type TeamRole } from "@/lib/permissions";

type TeamMember = {
  id: string;
  email: string;
  role: TeamRole;
  status: "pending" | "active" | "suspended";
  member_id: string | null;
  memberName: string | null;
  propertyIds: string[];
};

type Property = {
  id: string;
  name: string;
};

const ALL_ROLES: TeamRole[] = ["spouse", "manager", "employee"];

export default function TeamSettingsPage() {
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
  const [inviteRole, setInviteRole] = useState<TeamRole>("employee");

  const [invitePropertyIds, setInvitePropertyIds] = useState<string[]>([]);
  const [inviteSaving, setInviteSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<TeamRole>("employee");
  const [editEmail, setEditEmail] = useState("");

  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [keepHours, setKeepHours] = useState(true);

  useEffect(() => {
    loadTeam();
  }, []);

  async function loadTeam() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

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

      if (membership.role === "spouse") {
        setTeamOwnerId(membership.owner_id);

        const [{ data: ownerTeamData }, { data: propsData }] = await Promise.all([
          supabase
            .from("team_members")
            .select("id, email, role, status, member_id")
            .eq("owner_id", membership.owner_id)
            .order("created_at", { ascending: true }),
          supabase
            .from("properties")
            .select("id, name")
            .is("deleted_at", null)
            .order("name"),
        ]);

        setProperties(propsData ?? []);

        const ownerFiltered = (ownerTeamData ?? []).filter(
          (t) => t.member_id !== user.id && t.email.toLowerCase() !== userEmail
        );

        const ownerTeamMembers: TeamMember[] = [];
        for (const tm of ownerFiltered) {
          let mName: string | null = null;
          if (tm.member_id) {
            const { data: p } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", tm.member_id)
              .single();
            mName = p?.full_name ?? null;
          }
          const { data: assignments } = await supabase
            .from("property_assignments")
            .select("property_id")
            .eq("team_member_id", tm.id);
          ownerTeamMembers.push({
            ...tm,
            role: tm.role as TeamRole,
            status: tm.status as "pending" | "active" | "suspended",
            memberName: mName,
            propertyIds: (assignments ?? []).map((a) => a.property_id),
          });
        }
        setMembers(ownerTeamMembers);
        setLoading(false);
        return;
      }
    }

    // Owner view — load own team
    const [{ data: teamData }, { data: propsData }] = await Promise.all([
      supabase
        .from("team_members")
        .select("id, email, role, status, member_id")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("properties")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
    ]);

    setProperties(propsData ?? []);

    const filtered = (teamData ?? []).filter(
      (t) => t.member_id !== user.id && t.email.toLowerCase() !== userEmail
    );

    const teamMembers: TeamMember[] = [];
    for (const tm of filtered) {
      let memberName: string | null = null;
      if (tm.member_id) {
        const { data: p } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", tm.member_id)
          .single();
        memberName = p?.full_name ?? null;
      }

      const { data: assignments } = await supabase
        .from("property_assignments")
        .select("property_id")
        .eq("team_member_id", tm.id);

      teamMembers.push({
        ...tm,
        role: tm.role as TeamRole,
        status: tm.status as "pending" | "active" | "suspended",
        memberName,
        propertyIds: (assignments ?? []).map((a) => a.property_id),
      });
    }

    setMembers(teamMembers);
    setLoading(false);
  }

  async function handleInvite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setInviteSaving(true);
    setError(null);

    const result = await inviteTeamMember(email, inviteRole, invitePropertyIds, teamOwnerId || undefined);
    if (result.error) {
      setError(result.error);
      setInviteSaving(false);
      return;
    }

    setInviteEmail("");
    setInviteRole("employee");
    setInvitePropertyIds([]);
    setShowInvite(false);
    setInviteSaving(false);
    loadTeam();
  }

  async function handleSaveEdit(member: TeamMember) {
    setError(null);
    const emailChanged = editEmail.trim().toLowerCase() !== member.email.toLowerCase();
    const roleChanged = editRole !== member.role;

    if (emailChanged) {
      const result = await updateTeamMemberEmail(member.id, editEmail);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    if (roleChanged) {
      const result = await updateTeamMemberRole(member.id, editRole);
      if (result.error) {
        setError(result.error);
        return;
      }
    }

    setEditingId(null);
    loadTeam();
  }

  async function handleRemove(memberId: string) {
    setError(null);
    const result = await removeTeamMember(memberId, keepHours);
    if (result.error) {
      setError(result.error);
      return;
    }
    setConfirmRemoveId(null);
    setKeepHours(true);
    loadTeam();
  }

  function toggleInviteProperty(propertyId: string) {
    setInvitePropertyIds((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId],
    );
  }

  const hasSpouse = members.some((m) => m.role === "spouse") || teamRole === "spouse";
  const inviteRoles = hasSpouse ? ALL_ROLES.filter((r) => r !== "spouse") : ALL_ROLES;

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

      {isTeamMember && teamRole !== "spouse" && members.length === 0 ? (
        /* Team member view (manager/employee) — show the owner and the user's role */
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
        {/* Spouse's own row (when viewing as spouse) */}
        {teamOwnerId && (
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
                  Spouse
                </span>
              </div>
            </div>
          </div>
        )}
        {members.map((m) => (
            <div key={m.id} className="px-7 py-5 border-b border-chalk">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-serif text-[17px] font-medium text-char tracking-[-0.2px] truncate">
                      {m.memberName || m.email}
                    </span>
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
                  {m.memberName && (
                    <div className="text-[12px] text-slate mb-1">{m.email}</div>
                  )}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="font-mono text-[10px] uppercase tracking-[1px] text-plum font-medium">
                      {ROLE_LABELS[m.role]}
                    </span>
                    {m.role !== "spouse" && m.propertyIds.length > 0 && (
                      <span className="text-[11px] text-slate">
                        · {m.propertyIds.length} {m.propertyIds.length === 1 ? "property" : "properties"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {editingId !== m.id && confirmRemoveId !== m.id && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(m.id);
                          setEditRole(m.role);
                          setEditEmail(m.email);
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
                  )}
                </div>
              </div>

              {/* Inline role editor */}
              {editingId === m.id && (
                <div className="mt-4 p-4 rounded-md border border-chalk bg-vellum">
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
                    {(m.role === "spouse" || !hasSpouse ? ALL_ROLES : ALL_ROLES.filter((r) => r !== "spouse")).map((role) => (
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
                      disabled={editRole === m.role && editEmail.trim().toLowerCase() === m.email.toLowerCase()}
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
              {confirmRemoveId === m.id && (
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
          ))}
      </div>

      {/* Invite form */}
      {showInvite ? (
        <div className="mx-7 mt-6 p-5 rounded-md border border-chalk bg-vellum">
          <h3 className="font-serif text-[18px] font-medium text-plum mb-4">
            Invite team member
          </h3>

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

          {/* Property assignments (not for cohost — they get all) */}
          {inviteRole !== "spouse" && properties.length > 0 && (
            <div className="mb-5">
              <label className="font-mono text-[10px] tracking-[1.5px] uppercase text-quill font-medium mb-2 block">
                Assign properties
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
            </div>
          )}

          {inviteRole === "spouse" && (
            <div className="mb-5 px-3.5 py-3 rounded-md bg-plum-mist border border-plum/20">
              <p className="text-[12px] text-plum leading-relaxed">
                Only legally married spouses can combine hours for IRS material participation tests. Your spouse will have full access to all your properties.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteSaving || !inviteEmail.trim()}
              className="min-h-11 px-5 py-2.5 rounded-md text-[13px] font-medium bg-plum text-cream hover:bg-plum-deep transition-colors disabled:opacity-50"
            >
              {inviteSaving ? "Sending..." : "Send invite"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowInvite(false);
                setInviteEmail("");
                setInviteRole("employee");
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
