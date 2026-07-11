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

async function sendExpoPush(
  messages: PushMessage[],
): Promise<{ badTokens: string[]; deliveredIdx: Set<number> }> {
  const badTokens: string[] = [];
  // Indexes (into `messages`) that Expo accepted, or that are pointless to
  // retry (dead token). Transient failures stay unmarked so the next cron run
  // retries them instead of consuming the once-per-timer reminder.
  const deliveredIdx = new Set<number>();
  // Expo accepts up to 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    let res: Response;
    try {
      res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch {
      continue;
    }
    if (!res.ok) continue;
    const { data } = (await res.json()) as {
      data?: { status: string; details?: { error?: string } }[];
    };
    data?.forEach((ticket, idx) => {
      if (ticket.status === "ok") {
        deliveredIdx.add(i + idx);
      } else if (ticket.details?.error === "DeviceNotRegistered") {
        badTokens.push(chunk[idx].to);
        deliveredIdx.add(i + idx); // token is dead — retrying can't succeed
      }
    });
  }
  return { badTokens, deliveredIdx };
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
  const timerIdByMessage: string[] = [];
  const remindedTimerIds: string[] = [];
  for (const t of timers) {
    const token = tokenByUser.get(t.user_id);
    if (!token) {
      // No push token (web-only user): stamp so we don't re-scan the same
      // timer every run — there's nothing to deliver.
      remindedTimerIds.push(t.id);
      continue;
    }
    const hours = Math.round((Date.now() - new Date(t.started_at).getTime()) / 3600_000);
    const prop = t.property as { name: string } | { name: string }[] | null;
    const propName = (Array.isArray(prop) ? prop[0]?.name : prop?.name) ?? "a property";
    timerIdByMessage.push(t.id);
    messages.push({
      to: token,
      title: "Timer still running",
      body: `Your "${t.title}" timer at ${propName} has been running for ${hours} hours. Forgot to stop it?`,
      data: { url: "/timer" },
    });
  }

  const { badTokens, deliveredIdx } = messages.length
    ? await sendExpoPush(messages)
    : { badTokens: [], deliveredIdx: new Set<number>() };
  // Only stamp timers whose push Expo actually accepted (or whose token is
  // dead) — a transient Expo failure must not consume the one reminder.
  deliveredIdx.forEach((idx) => remindedTimerIds.push(timerIdByMessage[idx]));

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
