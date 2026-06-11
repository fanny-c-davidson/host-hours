import { Resend } from "resend";
import { ROLE_LABELS, type TeamRole } from "@/lib/permissions";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendInvitationEmail(params: {
  to: string;
  ownerName: string;
  role: TeamRole;
  token: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const inviteUrl = `${appUrl}/invite?token=${params.token}`;
  const roleLabel = ROLE_LABELS[params.role].toLowerCase();

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Host Hours <onboarding@resend.dev>",
    to: params.to,
    subject: `${params.ownerName} invited you to Host Hours`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F6F0E8;font-family:Georgia,'Times New Roman',serif;">
  <div style="max-width:480px;margin:0 auto;padding:48px 24px;">
    <div style="font-family:monospace;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#E65100;margin-bottom:16px;">Team Invitation</div>
    <h1 style="color:#4A148C;font-size:32px;font-weight:400;margin:0 0 12px;line-height:1.1;">You're invited.</h1>
    <p style="color:#5C4033;font-size:15px;line-height:1.7;margin:0 0 28px;">
      <strong>${params.ownerName}</strong> has invited you to join their team on Host Hours as a <strong>${roleLabel}</strong>.
    </p>
    <a href="${inviteUrl}" style="display:inline-block;background:#4A148C;color:#F6F0E8;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:15px;font-weight:500;">
      Accept invitation
    </a>
    <p style="color:#8C7B6B;font-size:12px;line-height:1.6;margin:28px 0 0;">
      This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
    </p>
    <hr style="border:none;border-top:1px solid #D4C9BC;margin:32px 0 16px;">
    <p style="color:#A89888;font-size:11px;margin:0;">Host Hours &mdash; STR Hour Tracking</p>
  </div>
</body>
</html>`,
  });

  if (error) {
    console.error("Failed to send invitation email:", error);
    throw new Error("Failed to send invitation email");
  }
}
