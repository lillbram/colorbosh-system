/**
 * Parser for TikTok Seller Center return export
 * ("Pesanan_yang_Barang_Dananya_Dikembalikan-*.xlsx"). Pure, no DB.
 * IDs must be read as text by the caller (they exceed Number precision).
 */

export type ReturnStatus = "processing" | "completed" | "rejected";

export type ParsedReturn = {
  externalReturnId: string;
  externalOrderId: string;
  /** ISO 8601 with +07:00 offset (Asia/Jakarta). */
  requestedAt: string;
  refundedAt: string | null;
  qty: number;
  refundAmount: number;
  status: ReturnStatus;
  reason: string | null;
  buyerNote: string | null;
  sellerSku: string | null;
  productName: string | null;
};

/** "Rp54.048" → 54048. Returns null when there is no positive number. */
export function parseRupiah(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const digits = String(raw).replace(/,\d{1,2}$/, "").replace(/[^\d]/g, "");
  const n = Number(digits);
  return digits && n > 0 ? n : null;
}

/** "06/11/2026 16:18:50" (Jakarta wall time) → "2026-11-06T16:18:50+07:00". */
export function parseJakartaDateTime(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
  const day = Number(d);
  const month = Number(mo);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const pad = (v: string | number) => String(v).padStart(2, "0");
  return `${y}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(mi)}:${pad(s)}+07:00`;
}

export function mapReturnStatus(returnStatus: string, returnSubStatus: string): ReturnStatus {
  const status = returnStatus.trim().toLowerCase();
  const sub = returnSubStatus.trim().toLowerCase();
  if (sub === "request canceled" || status === "refund rejected") return "rejected";
  if (status === "completed") return "completed";
  return "processing";
}

function pick(rec: Record<string, unknown>, ...names: string[]): string {
  const keys = Object.keys(rec);
  for (const name of names) {
    const key = keys.find((k) => k.trim().toLowerCase() === name.toLowerCase());
    if (key !== undefined && rec[key] != null) return String(rec[key]).trim();
  }
  return "";
}

export function parseTikTokReturnRow(
  rec: Record<string, unknown>
): { ok: true; row: ParsedReturn } | { ok: false; error: string } {
  const externalReturnId = pick(rec, "Return Order ID");
  if (!externalReturnId) return { ok: false, error: "Return Order ID kosong" };
  if (/[eE]\+/.test(externalReturnId)) {
    return { ok: false, error: "ID terbaca sebagai angka ilmiah — baca file sebagai teks" };
  }

  const requestedAt = parseJakartaDateTime(pick(rec, "Time Requested"));
  if (!requestedAt) return { ok: false, error: "Time Requested tidak valid (dd/MM/yyyy HH:mm:ss)" };

  const qty = Number(pick(rec, "Return Quantity"));
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, error: "Return Quantity tidak valid" };

  const unitPrice = parseRupiah(pick(rec, "Return unit price"));
  if (unitPrice === null) return { ok: false, error: "Return unit price tidak valid" };

  return {
    ok: true,
    row: {
      externalReturnId,
      externalOrderId: pick(rec, "Order ID"),
      requestedAt,
      refundedAt: parseJakartaDateTime(pick(rec, "Refund Time")),
      qty,
      refundAmount: unitPrice * qty,
      status: mapReturnStatus(pick(rec, "Return Status"), pick(rec, "Return Sub Status")),
      reason: pick(rec, "Return Reason") || null,
      buyerNote: pick(rec, "Buyer Note") || null,
      sellerSku: pick(rec, "Seller SKU") || null,
      productName: pick(rec, "Product Name") || null,
    },
  };
}
