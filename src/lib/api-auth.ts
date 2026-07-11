import { NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Resolves the caller for API routes that serve both the web app (cookie
// session) and the mobile app (Authorization: Bearer <access token>).
export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return user;

  const authz = req.headers.get("authorization");
  const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) return null;

  const { data } = await createServiceClient().auth.getUser(token);
  return data.user;
}
