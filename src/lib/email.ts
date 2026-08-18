import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[];
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn("RESEND_API_KEY belum diatur — email dilewati:", subject);
    return { skipped: true };
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "noreply@cardigan-biz.com",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("Gagal mengirim email:", error);
    return { error: error.message };
  }

  return { success: true };
}
