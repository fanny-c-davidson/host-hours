import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// Cron: remind users whose timer has been running for a long time (they may
// have forgotten to stop it). Runs on a Vercel cron schedule; each timer gets
// exactly one reminder (reminder_sent_at). Requires CRON_SECRET.
//
// Sends through Expo's push service to the token saved by the mobile app
// (profiles.expo_push_token). Tokens Expo reports as DeviceNotRegistered are
// cleared so we stop sending to dead installs.

const REMINDER_AFTER_HOURS = Number(process.env.TIMER_REMINDER_AFTER_HOURS ?? 4);

type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

async function sendExpoPush(messages: PushMessage[]): Promise<{ badTokens: string[] }> {
  const badTokens: string[] = [];
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });
    if (!res.ok) continue;
    const { data } = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    data?.forEach((ticket, idx) => {
      if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
        badTokens.push(chunk[idx].to);
      }
    });
  }
  return { badTokens };
}

export async function GET(req: NextRequest) {
  const authz = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authz !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const db = createServiceClient();
  const cutoff = new Date(Date.now() - REMINDER_AFTER_HOURS * 3600_000).toISOString();

  const { data: timers } = await db
    .from("active_timers")
    .select("id, user_id, title, started_at, property:properties(name)")
    .lt("started_at", cutoff)
    .is("reminder_sent_at", null);

  if (!timers || timers.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0 });
  }

  const userIds = Array.from(new Set(timers.map((t) => t.user_id)));
  const { data: profiles } = await db
    .from("profiles")
    .select("id, expo_push_token")
    .in("id", userIds)
    .not("expo_push_token", "is", null);
  const tokenByUser = new Map((profiles ?? []).map((p) => [p.id, p.expo_push_token as string]));

  const messages: PushMessage[] = [];
  const remindedTimerIds: string[] = [];
  for (const t of timers) {
    const token = tokenByUser.get(t.user_id);
    // No push token (web-only user) still gets reminder_sent_at stamped so we
    // don't re-scan the same timer every run.
    remindedTimerIds.push(t.id);
    if (!token) continue;
    const hours = Math.round((Date.now() - new Date(t.started_at).getTime()) / 3600_000);
    const prop = t.property as { name: string } | { name: string }[] | null;
    const propName = (Array.isArray(prop) ? prop[0]?.name : prop?.name) ?? "a property";
    messages.push({
      to: token,
      title: "Timer still running",
      body: `Your "${t.title}" timer at ${propName} has been running for ${hours} hours. Forgot to stop it?`,
      data: { url: "/timer" },
    });
  }

  const { badTokens } = messages.length ? await sendExpoPush(messages) : { badTokens: [] };

  await db
    .from("active_timers")
    .update({ reminder_sent_at: new Date().toISOString() })
    .in("id", remindedTimerIds);

  if (badTokens.length) {
    await db.from("profiles").update({ expo_push_token: null }).in("expo_push_token", badTokens);
  }

  return NextResponse.json({
    ok: true,
    reminded: messages.length,
    stamped: remindedTimerIds.length,
    clearedTokens: badTokens.length,
  });
}
