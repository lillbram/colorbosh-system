"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, withTransaction } from "@/db";
import { salesEntries } from "@/db/schema";
import { allocateFee } from "@/lib/tiktok-settlement";

const payloadSchema = z.object({
  channelId: z.string().uuid("Pilih channel"),
  rows: z
    .array(
      z.object({
        orderRef: z.string().min(1),
        subtotal: z.number().nullable(),
        fee: z.number().min(0),
      })
    )
    .min(1, "Tidak ada baris untuk diproses"),
});

export type SettlementResult =
  | {
      ok: true;
      updated: number;
      totalFee: number;
      unmatched: string[];
      /** Orders where the file's subtotal differs from the app's gross by more than Rp1. */
      mismatched: { orderRef: string; app: number; file: number }[];
    }
  | { ok: false; error: string };

/**
 * Writes the real platform fee onto the matching sales rows (replacing the
 * estimate from channels.default_fee_pct). Gross stays as entered. Idempotent:
 * values are set, not added, so re-importing the same workbook changes nothing.
 * net_expected is a generated column, so Penjualan Bersih / Laba follow.
 */
export async function applyTikTokSettlement(payload: z.input<typeof payloadSchema>): Promise<SettlementResult> {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Data tidak valid" };
  const { channelId, rows } = parsed.data;

  let updated = 0;
  let totalFee = 0;
  const unmatched: string[] = [];
  const mismatched: { orderRef: string; app: number; file: number }[] = [];

  try {
    await withTransaction(async (tx) => {
      const t = tx as unknown as typeof db;
      for (const r of rows) {
        const entries = await t
          .select({ id: salesEntries.id, gross: salesEntries.grossAmount })
          .from(salesEntries)
          .where(
            and(
              eq(salesEntries.channelId, channelId),
              eq(salesEntries.orderRef, r.orderRef),
              eq(salesEntries.isDeleted, false)
            )
          );
        if (entries.length === 0) {
          unmatched.push(r.orderRef);
          continue;
        }
        const grosses = entries.map((e) => Number(e.gross));
        const appGross = grosses.reduce((s, g) => s + g, 0);
        if (r.subtotal !== null && Math.abs(appGross - r.subtotal) > 1) {
          mismatched.push({ orderRef: r.orderRef, app: appGross, file: r.subtotal });
        }
        const fees = allocateFee(r.fee, grosses);
        for (let i = 0; i < entries.length; i++) {
          await t
            .update(salesEntries)
            .set({ platformFeeEst: String(fees[i]) })
            .where(eq(salesEntries.id, entries[i].id));
        }
        updated += 1;
        totalFee += r.fee;
      }
    });
  } catch {
    return { ok: false, error: "Gagal memperbarui fee penjualan" };
  }

  revalidatePath("/sales");
  revalidatePath("/reports");
  revalidatePath("/");
  return { ok: true, updated, totalFee, unmatched, mismatched };
}
