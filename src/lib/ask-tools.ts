import type Anthropic from "@anthropic-ai/sdk";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { salesReturns } from "@/db/schema";
import { getPnL, getSalaryOverview, getWorkingCapital } from "@/lib/finance";
import { isValidMonth, monthRange, todayJakarta } from "@/lib/period";
import { getLowStockThreshold, getStockLevels } from "@/lib/stock";

/**
 * Read-only functions the "Tanya Keuangan" chat may call. Each returns plain
 * numbers computed by the same modules as the rest of the app — the model must
 * not do arithmetic of its own on raw rows.
 */
export const ASK_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_pnl",
    description:
      "Laba rugi satu bulan: total penjualan, diskon, fee platform, penjualan bersih, HPP, laba kotor, rugi retur, operasional, laba bersih, dan penjualan per channel.",
    input_schema: {
      type: "object",
      properties: { month: { type: "string", description: "Bulan, format YYYY-MM, contoh 2026-10" } },
      required: ["month"],
      additionalProperties: false,
    },
  },
  {
    name: "get_working_capital",
    description: "Modal berjalan pada satu tanggal: kas bank, saldo marketplace, nilai stok, sisa gaji, dan totalnya.",
    input_schema: {
      type: "object",
      properties: { date: { type: "string", description: "Tanggal YYYY-MM-DD; kosongkan untuk hari ini" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_salary",
    description: "Hak gaji, yang sudah dibayar, dan sisanya per bulan. Isi month untuk satu bulan saja, kosongkan untuk semua bulan.",
    input_schema: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM, opsional" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_returns",
    description: "Retur satu bulan (berdasarkan tanggal diminta): jumlah retur, pcs, total refund, rugi retur, dan statusnya.",
    input_schema: {
      type: "object",
      properties: { month: { type: "string", description: "YYYY-MM" } },
      required: ["month"],
      additionalProperties: false,
    },
  },
  {
    name: "get_stock",
    description: "Stok saat ini per produk, nilai stok (stok × HPP), dan mana yang menipis atau habis.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
];

const monthInput = z.object({ month: z.string().refine(isValidMonth, "Format bulan harus YYYY-MM") });

export async function runAskTool(name: string, input: unknown): Promise<unknown> {
  switch (name) {
    case "get_pnl": {
      const { month } = monthInput.parse(input);
      const r = monthRange(month);
      return { month, ...(await getPnL(r.start, r.end)) };
    }
    case "get_working_capital": {
      const { date } = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(input);
      return getWorkingCapital(date ?? todayJakarta());
    }
    case "get_salary": {
      const { month } = z.object({ month: z.string().refine(isValidMonth).optional() }).parse(input);
      const overview = await getSalaryOverview();
      const months = overview.months.map((m) => ({
        month: m.month,
        labaBersih: m.labaBersih,
        hakGaji: m.entitlement,
        sudahDibayar: m.paid,
        sisa: Math.max(0, m.remaining),
      }));
      return { persenGaji: overview.pct * 100, months: month ? months.filter((m) => m.month === month) : months };
    }
    case "get_returns": {
      const { month } = monthInput.parse(input);
      const r = monthRange(month);
      const rows = await db
        .select({
          qty: salesReturns.qty,
          refund: salesReturns.refundAmount,
          hpp: salesReturns.hppPerUnit,
          restock: salesReturns.restock,
          status: salesReturns.status,
        })
        .from(salesReturns)
        .where(
          and(
            eq(salesReturns.isDeleted, false),
            sql`${salesReturns.requestedAt} >= (${r.start}::timestamp at time zone 'Asia/Jakarta')`,
            sql`${salesReturns.requestedAt} < ((${r.end}::date + 1)::timestamp at time zone 'Asia/Jakarta')`
          )
        );
      const counted = rows.filter((x) => x.status !== "rejected");
      return {
        month,
        jumlahRetur: counted.length,
        pcs: counted.reduce((s, x) => s + x.qty, 0),
        totalRefund: counted.reduce((s, x) => s + Number(x.refund), 0),
        rugiRetur: counted.reduce((s, x) => s + Number(x.refund) - (x.restock ? Number(x.hpp) * x.qty : 0), 0),
        ditolak: rows.length - counted.length,
        selesai: counted.filter((x) => x.status === "completed").length,
        diproses: counted.filter((x) => x.status === "processing").length,
      };
    }
    case "get_stock": {
      const [levels, threshold] = await Promise.all([getStockLevels(), getLowStockThreshold()]);
      return {
        batasMenipis: threshold,
        produk: levels.map((l) => ({
          nama: l.name,
          stok: l.qty,
          nilai: Math.max(0, l.qty) * l.hppTarget,
          status: !l.hasOpening ? "stok awal belum diatur" : l.qty <= 0 ? "habis" : l.qty <= threshold ? "menipis" : "aman",
        })),
        totalNilai: levels.reduce((s, l) => s + Math.max(0, l.qty) * l.hppTarget, 0),
      };
    }
    default:
      throw new Error(`Tool tidak dikenal: ${name}`);
  }
}
