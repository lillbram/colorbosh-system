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

export function dailyReminderEmail(params: {
  overduePOs: { poNumber: string; supplierName: string | null; expectedDate: string | null }[];
  overdueTermins: { batchCode: string; terminNo: number; amount: string }[];
  upcomingBatches: { batchCode: string; targetFinishDate: string }[];
  eligiblePayouts: { channelName: string | null; amount: string }[];
}) {
  const { overduePOs, overdueTermins, upcomingBatches, eligiblePayouts } = params;
  const hasAnything =
    overduePOs.length + overdueTermins.length + upcomingBatches.length + eligiblePayouts.length > 0;

  if (!hasAnything) {
    return {
      subject: "Cardigan Biz — Tidak ada yang perlu diperhatikan hari ini",
      html: `<p>Semua pemesanan, produksi, dan pencairan dana berjalan lancar hari ini. 👍</p>`,
    };
  }

  const section = (title: string, items: string[]) =>
    items.length === 0
      ? ""
      : `<h3 style="margin:16px 0 8px;font-size:14px;">${title}</h3><ul style="margin:0;padding-left:20px;font-size:13px;">${items
          .map((i) => `<li>${i}</li>`)
          .join("")}</ul>`;

  const html = `
    <div style="font-family:sans-serif;color:#1A1A1A;max-width:480px;">
      <h2 style="font-size:18px;">Ringkasan Perlu Perhatian Hari Ini</h2>
      ${section(
        "Pemesanan Kain Terlambat",
        overduePOs.map(
          (po) => `${po.poNumber} (${po.supplierName ?? "-"}) — estimasi tiba ${po.expectedDate}`
        )
      )}
      ${section(
        "Termin Penjahit Jatuh Tempo",
        overdueTermins.map((t) => `${t.batchCode} — Termin ${t.terminNo} (Rp ${Number(t.amount).toLocaleString("id-ID")})`)
      )}
      ${section(
        "Batch Produksi Segera Selesai",
        upcomingBatches.map((b) => `${b.batchCode} — target selesai ${b.targetFinishDate}`)
      )}
      ${section(
        "Dana Siap Dicairkan",
        eligiblePayouts.map((p) => `${p.channelName ?? "-"} — Rp ${Number(p.amount).toLocaleString("id-ID")}`)
      )}
    </div>
  `;

  return { subject: "Cardigan Biz — Ringkasan Perlu Perhatian Hari Ini", html };
}
