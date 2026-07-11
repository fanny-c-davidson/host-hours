import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  // Mobile clients authenticate with a Bearer token instead of cookies.
  if (!user) {
    const authz = req.headers.get("authorization");
    const token = authz?.startsWith("Bearer ") ? authz.slice(7) : null;
    if (token) {
      const { data } = await createServiceClient().auth.getUser(token);
      user = data.user;
    }
  }
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const { csv, email, property } = await req.json();

  if (!csv || !email) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return NextResponse.json(
      { error: "Email service not configured. Add RESEND_API_KEY to .env.local" },
      { status: 500 }
    );
  }

  const subject = `Host Hours Report — ${property || "All properties"} — ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  const csvBase64 = Buffer.from(csv).toString("base64");

  // Use the verified sender (same as invitation emails). The resend.dev testing
  // domain can only email your own address, so it 403s for any other recipient.
  const from = process.env.RESEND_FROM_EMAIL || "Host Hours <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      text: `Your Host Hours report is attached.\n\nProperty: ${property || "All properties"}\nGenerated: ${new Date().toLocaleString("en-US")}\n\nThis is an automated report from Host Hours.`,
      attachments: [
        {
          filename: `host-hours-report.csv`,
          content: csvBase64,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
