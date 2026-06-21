"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TeamRole } from "@/lib/permissions";

type TeamContext = {
  isOwner: boolean;
  role: TeamRole | null;
  ownerId: string | null;
  teamMemberId: string | null;
  assignedPropertyIds: string[];
};

const DEFAULT_CONTEXT: TeamContext = {
  isOwner: true,
  role: null,
  ownerId: null,
  teamMemberId: null,
  assignedPropertyIds: [],
};

export function useTeamContext() {
  const [context, setContext] = useState<TeamContext>(DEFAULT_CONTEXT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: memberships } = await supabase
        .from("team_members")
        .select("id, owner_id, role, status")
        .eq("member_id", user.id)
        .eq("status", "active");

      if (!memberships || memberships.length === 0) {
        setContext({ ...DEFAULT_CONTEXT, ownerId: user.id });
        setLoading(false);
        return;
      }

      // For now, use the first active membership.
      // When a user is on multiple teams, UI will let them switch.
      const membership = memberships[0];

      const { data: assignments } = await supabase
        .from("property_assignments")
        .select("property_id")
        .eq("team_member_id", membership.id);

      setContext({
        isOwner: false,
        role: membership.role as TeamRole,
        ownerId: membership.owner_id,
        teamMemberId: membership.id,
        assignedPropertyIds: (assignments ?? []).map((a) => a.property_id),
      });
      setLoading(false);
    }
    load();
  }, []);

  return { ...context, loading };
}
