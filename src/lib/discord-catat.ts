import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { discordPending, users } from "@/db/schema";
import { formatDate, formatIDR } from "@/lib/format";
import { lockedMonthError } from "@/lib/month-lock";
import { todayJakarta } from "@/lib/period";
import { MAX_PROOF_BYTES, PROOF_MIME_TYPES, uploadProof } from "@/lib/proof-storage";
import { analyze, type ReceiptAnalysis } from "@/lib/receipt-analysis";
import { claudeVisionEnabled, extractReceiptWithClaude } from "@/lib/receipt-claude";
import type { ExtractedReceipt } from "@/lib/receipt-parser";
import { saveReceipt } from "@/lib/receipt-save";

export type DiscordAttachment = { url: string; content_type?: string; size?: number; filename?: string };

type Pending = {
  path: string;
  extracted: ExtractedReceipt;
  analysis: ReceiptAnalysis;
};

const ALLOWED_HOSTS = ["cdn.discordapp.com", "media.discordapp.net"];
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

/** "498...=Bram,157...=Shin" → display name for the audit trail; falls back to the raw ID. */
export function discordName(userId: string): string {
  for (const pair of (process.env.DISCORD_USER_NAMES ?? "").split(",")) {
    const [id, name] = pair.split("=").map((x) => x.trim());
    if (id === userId && name) return name;
  }
  return userId;
}

/** Audit actor: DISCORD_ACTOR_USER_ID if set, otherwise the first active owner. */
async function actorId(): Promise<string | null> {
  const fixed = process.env.DISCORD_ACTOR_USER_ID;
  if (fixed) return fixed;
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "owner"), eq(users.isActive, true)))
    .orderBy(users.createdAt)
    .limit(1);
  return owner?.id ?? null;
}

export function describeReceipt(r: ExtractedReceipt, a: ReceiptAnalysis): string {
  const date = (r.datetime ?? todayJakarta()).slice(0, 10);
  const who = r.direction === "out" ? r.recipientName : r.senderName;
  const lines = [
    `**Bukti terbaca** — ${r.direction === "out" ? "Uang Keluar" : "Uang Masuk"} **${formatIDR(r.amount ?? 0)}** · ${formatDate(date)}`,
    who ? `${r.direction === "out" ? "Ke" : "Dari"}: ${who}` : null,
    r.note ? `Catatan: ${r.note}` : null,
    a.categoryName ? `Kategori: ${a.categoryName}${a.periodMonth ? ` (bulan ${a.periodMonth})` : ""}` : "Kategori: belum ada saran",
    r.adminFee > 0 ? `Biaya admin: ${formatIDR(r.adminFee)} (dicatat terpisah)` : null,
    a.needsReview ? `⚠️ Perlu dicek: ${a.reason}` : null,
    r.confidence < 0.7 ? "⚠️ Tulisan kurang jelas, cek angkanya dulu." : null,
  ];
  return lines.filter(Boolean).join("\n");
}

export type CatatReply = { content: string; components?: unknown[] };

/** Slash command /catat with a screenshot: read it, store a pending proposal, return the message with buttons. */
export async function prepareCatat(att: DiscordAttachment, discordUserId: string): Promise<CatatReply> {
  if (!claudeVisionEnabled()) return { content: "Pembaca gambar belum aktif (ANTHROPIC_API_KEY belum diisi di Vercel)." };

  const mime = att.content_type?.split(";")[0] ?? "";
  if (!(PROOF_MIME_TYPES as readonly string[]).includes(mime)) {
    return { content: "Kirim foto JPG, PNG, atau WebP. File Excel belum didukung lewat Discord." };
  }
  if ((att.size ?? 0) > MAX_PROOF_BYTES) return { content: "Foto terlalu besar (maksimal 5 MB)." };
  let host = "";
  try {
    host = new URL(att.url).hostname;
  } catch {}
  if (!ALLOWED_HOSTS.includes(host)) return { content: "Lampiran tidak valid." };

  const actor = await actorId();
  if (!actor) return { content: "Tidak ada akun pemilik aktif untuk mencatat." };

  const res = await fetch(att.url);
  if (!res.ok) return { content: "Gagal mengunduh foto dari Discord." };
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_PROOF_BYTES) return { content: "Foto terlalu besar (maksimal 5 MB)." };

  const extracted = await extractReceiptWithClaude(bytes, mime as (typeof PROOF_MIME_TYPES)[number]);
  if (!extracted || !extracted.amount) return { content: "Foto tidak bisa dibaca sebagai bukti transfer. Coba foto yang lebih jelas." };

  const analysis = await analyze(extracted);
  if (analysis.duplicate) {
    const d = analysis.duplicate;
    return { content: `Bukti ini sudah tercatat: ${formatDate(d.txnDate)} · ${formatIDR(d.amount)} · ${d.description ?? "-"}` };
  }

  const path = await uploadProof(bytes, mime, actor);
  const [row] = await db
    .insert(discordPending)
    .values({ kind: "receipt", payload: { path, extracted, analysis } satisfies Pending, discordUserId })
    .returning({ id: discordPending.id });

  return {
    content: describeReceipt(extracted, analysis),
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Konfirmasi", custom_id: `catat:ok:${row.id}` },
          { type: 2, style: 4, label: "Batal", custom_id: `catat:no:${row.id}` },
        ],
      },
    ],
  };
}

/** Button press. Claims the pending row atomically so a double-click saves once. */
export async function resolveCatat(action: "ok" | "no", pendingId: string, clickerId: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(pendingId)) return "Permintaan tidak valid.";
  const claimed = await db
    .update(discordPending)
    .set({ status: action === "ok" ? "done" : "cancelled" })
    .where(
      and(
        eq(discordPending.id, pendingId),
        eq(discordPending.status, "pending"),
        gt(discordPending.createdAt, sql`now() - interval '${sql.raw(String(PENDING_TTL_MS / 1000))} seconds'`)
      )
    )
    .returning({ payload: discordPending.payload });
  const row = claimed[0];
  if (!row) return "Sudah diproses atau kedaluwarsa.";
  if (action === "no") return `Dibatalkan oleh ${discordName(clickerId)}.`;

  const { path, extracted: r, analysis: a } = row.payload as Pending;
  if (!a.accountId) return "Ada lebih dari satu akun aktif — catat bukti ini lewat halaman web (Arus Kas > Bukti Transfer).";
  const txnDate = (r.datetime ?? todayJakarta()).slice(0, 10);
  const lock = await lockedMonthError([txnDate], "bukti transfer");
  if (lock) return lock;

  const who = discordName(clickerId);
  const base = r.direction === "out" && r.recipientName ? `Transfer ke ${r.recipientName}` : r.senderName ? `Transfer dari ${r.senderName}` : "Transfer";
  const description = [base, r.note].filter(Boolean).join(" · ").slice(0, 150) + ` (via Discord: ${who})`;

  const actor = await actorId();
  const result = await saveReceipt(
    {
      txnDate,
      accountId: a.accountId,
      direction: r.direction,
      amount: r.amount ?? 0,
      adminFee: r.adminFee,
      categoryId: a.categoryId ?? undefined,
      description,
      counterparty: (r.direction === "out" ? r.recipientName : r.senderName) ?? null,
      bankRef: r.bankRef?.trim() || null,
      periodMonth: a.periodMonth ?? undefined,
      proofPath: path,
      status: "draft",
    },
    actor,
    { via: "discord", discordUserId: clickerId, discordName: who }
  );
  if (!result.ok) return result.error;
  return `✅ Tersimpan sebagai "Perlu dicek" di Arus Kas oleh ${who}. Buka web untuk mengonfirmasi.`;
}
