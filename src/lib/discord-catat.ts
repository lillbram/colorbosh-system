import * as XLSX from "xlsx";
import { and, eq, gt, sql } from "drizzle-orm";
import { db, withTransaction } from "@/db";
import { accounts, cashTransactions, categories, discordPending, users } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { resolveCashRows, type ResolvedRow } from "@/lib/cash-import";
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

type ExcelPending = { rows: ResolvedRow[] };
const MAX_EXCEL_BYTES = 2 * 1024 * 1024;
const MAX_EXCEL_ROWS = 500;
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type CatatReply = { content: string; components?: unknown[] };

/** Slash command /catat with a screenshot: read it, store a pending proposal, return the message with buttons. */
export async function prepareCatat(att: DiscordAttachment, discordUserId: string): Promise<CatatReply> {
  const isExcel = att.content_type?.startsWith(XLSX_MIME) || /\.xlsx$/i.test(att.filename ?? "");
  if (isExcel) return prepareExcel(att, discordUserId);
  if (!claudeVisionEnabled()) return { content: "Pembaca gambar belum aktif (ANTHROPIC_API_KEY belum diisi di Vercel)." };

  const mime = att.content_type?.split(";")[0] ?? "";
  if (!(PROOF_MIME_TYPES as readonly string[]).includes(mime)) {
    return { content: "Kirim foto JPG, PNG, atau WebP, atau file Excel (.xlsx) dari template Arus Kas." };
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

function validDiscordUrl(url: string): boolean {
  try {
    return ALLOWED_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** /catat with an .xlsx made from the Arus Kas template (same columns and checks as the web import). */
async function prepareExcel(att: DiscordAttachment, discordUserId: string): Promise<CatatReply> {
  if ((att.size ?? 0) > MAX_EXCEL_BYTES) return { content: "File terlalu besar (maksimal 2 MB)." };
  if (!validDiscordUrl(att.url)) return { content: "Lampiran tidak valid." };

  const res = await fetch(att.url);
  if (!res.ok) return { content: "Gagal mengunduh file dari Discord." };
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_EXCEL_BYTES) return { content: "File terlalu besar (maksimal 2 MB)." };

  let raw: Record<string, unknown>[];
  try {
    const wb = XLSX.read(bytes, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets["Template"] ?? wb.Sheets[wb.SheetNames[0]];
    raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch {
    return { content: "File Excel tidak bisa dibaca." };
  }
  if (raw.length === 0) return { content: "File kosong." };
  if (raw.length > MAX_EXCEL_ROWS) return { content: `Terlalu banyak baris (maksimal ${MAX_EXCEL_ROWS}).` };
  if (!("Tanggal" in raw[0]) || !("Nominal" in raw[0])) {
    return {
      content: "Kolom tidak cocok. Pakai template di web (Arus Kas > Impor Excel > Download Template): Tanggal, Arah, Akun, Kategori, Keterangan, Nominal.",
    };
  }

  const [accountRows, categoryRows] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)),
    db.select({ id: categories.id, name: categories.name }).from(categories),
  ]);
  const rows = resolveCashRows(raw, accountRows, categoryRows);
  const good = rows.filter((r) => r.valid);
  const bad = rows.map((r, i) => ({ r, line: i + 2 })).filter((x) => !x.r.valid);
  if (good.length === 0) {
    return { content: `Tidak ada baris yang valid.
${bad.slice(0, 8).map((b) => `• baris ${b.line}: ${b.r.reason}`).join("\n")}` };
  }

  const sum = (dir: "in" | "out") => good.filter((r) => r.direction === dir).reduce((t, r) => t + r.amount, 0);
  const [row] = await db
    .insert(discordPending)
    .values({ kind: "cash_excel", payload: { rows: good } satisfies ExcelPending, discordUserId })
    .returning({ id: discordPending.id });

  const lines = [
    `**File Excel terbaca** — ${good.length} baris valid${bad.length ? `, ${bad.length} dilewati` : ""}`,
    `Uang Masuk: ${formatIDR(sum("in"))} · Uang Keluar: ${formatIDR(sum("out"))}`,
    ...(bad.length ? ["Baris bermasalah (tidak ikut diimpor):", ...bad.slice(0, 6).map((b) => `• baris ${b.line}: ${b.r.reason}`)] : []),
    bad.length > 6 ? `…dan ${bad.length - 6} lainnya` : null,
  ];
  return {
    content: lines.filter(Boolean).join("\n"),
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: `Impor ${good.length} baris`, custom_id: `catat:ok:${row.id}` },
          { type: 2, style: 4, label: "Batal", custom_id: `catat:no:${row.id}` },
        ],
      },
    ],
  };
}

async function importExcelRows(pendingId: string, payload: ExcelPending, clickerId: string): Promise<string> {
  const lock = await lockedMonthError(payload.rows.map((r) => r.txnDate), "impor kas");
  if (lock) return lock;
  const who = discordName(clickerId);
  const actor = await actorId();
  try {
    await withTransaction(async (tx) => {
      await tx.insert(cashTransactions).values(
        payload.rows.map((r) => ({
          txnDate: r.txnDate,
          accountId: r.accountId as string,
          direction: r.direction as "in" | "out",
          amount: String(r.amount),
          categoryId: r.categoryId || null,
          relatedType: "manual" as const,
          description: r.description,
          source: "bulk_excel" as const,
          status: "draft" as const,
          createdBy: actor,
        }))
      );
      await writeAuditLog(tx as unknown as typeof db, {
        entityType: "cash_import",
        entityId: pendingId,
        action: "create",
        actorId: actor,
        diff: { via: "discord", discordUserId: clickerId, discordName: who, rows: payload.rows.length },
      });
    });
  } catch {
    return "Gagal mengimpor transaksi.";
  }
  return `✅ ${payload.rows.length} baris masuk Arus Kas sebagai "Perlu dicek" oleh ${who}.`;
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
    .returning({ payload: discordPending.payload, kind: discordPending.kind });
  const row = claimed[0];
  if (!row) return "Sudah diproses atau kedaluwarsa.";
  if (action === "no") return `Dibatalkan oleh ${discordName(clickerId)}.`;

  if (row.kind === "cash_excel") return importExcelRows(pendingId, row.payload as ExcelPending, clickerId);

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
