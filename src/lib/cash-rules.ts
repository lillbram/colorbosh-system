/**
 * Suggests a category (and salary month) for a cash transaction from what the
 * proof or bank statement says. Pure — the caller maps names to category ids.
 * The suggestion is a starting point the admin can change; see
 * docs/COLORBOSH_DEV_SPEC.md §4 Phase 6.
 */
export type RuleInput = {
  direction: "in" | "out";
  counterparty: string | null;
  note: string | null;
  /** Free text such as the bank statement description. */
  description?: string | null;
  recipientAccount?: string | null;
};

export type RuleResult = {
  categoryName: string | null;
  /** Row should be saved as draft and flagged "perlu dicek". */
  needsReview: boolean;
  /** "YYYY-MM" when the note names the month (GAJI-NOV). */
  periodMonth: string | null;
  /** Gaji without a month: caller picks the oldest unpaid month. */
  allocateOldestUnpaid: boolean;
  reason: string;
};

const MONTH_TOKENS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MEI: 5, JUN: 6, JUL: 7, AGU: 8, AGT: 8, SEP: 9, OKT: 10, NOV: 11, DES: 12,
};

const NONE: RuleResult = {
  categoryName: null,
  needsReview: false,
  periodMonth: null,
  allocateOldestUnpaid: false,
  reason: "",
};

/** "NOV" → "2026-11" given today's "YYYY-MM-DD"; a month later than now means last year. */
export function monthFromToken(token: string, today: string): string | null {
  const month = MONTH_TOKENS[token.slice(0, 3).toUpperCase()];
  if (!month) return null;
  const year = Number(today.slice(0, 4));
  const nowMonth = Number(today.slice(5, 7));
  const y = month > nowMonth ? year - 1 : year;
  return `${y}-${String(month).padStart(2, "0")}`;
}

export function suggestCategory(input: RuleInput, today: string): RuleResult {
  const note = (input.note ?? "").trim();
  const who = (input.counterparty ?? "").toUpperCase();
  const text = `${input.description ?? ""} ${note}`.toUpperCase();

  // 1. Explicit note prefix wins.
  const prefix = note.toUpperCase().match(/^(GAJI|JAHIT|OPS|BAHAN|IKLAN)\b[-\s:]*([A-Z]+)?/);
  if (prefix) {
    const byPrefix: Record<string, string> = {
      GAJI: "Gaji",
      JAHIT: "Pembayaran Penjahit",
      OPS: "Operasional Toko",
      BAHAN: "Bahan",
      IKLAN: "Iklan",
    };
    const periodMonth = prefix[1] === "GAJI" && prefix[2] ? monthFromToken(prefix[2], today) : null;
    return {
      ...NONE,
      categoryName: byPrefix[prefix[1]],
      periodMonth,
      allocateOldestUnpaid: prefix[1] === "GAJI" && !periodMonth,
      reason: `Catatan diawali ${prefix[1]}`,
    };
  }

  if (input.direction === "out") {
    // 2–3. Transfers to the admin.
    if (who.includes("SHINTHYA")) {
      if (/GAJI|GAJIAN/i.test(note)) {
        return { ...NONE, categoryName: "Gaji", allocateOldestUnpaid: true, reason: "Transfer ke Shinthya, catatan gaji" };
      }
      return { ...NONE, categoryName: "Operasional Toko", needsReview: true, reason: "Transfer ke Shinthya tanpa catatan gaji" };
    }
    // 4. Tailor.
    if (who.includes("SRI RATIH") || input.recipientAccount?.replace(/\s/g, "") === "5245110232") {
      return { ...NONE, categoryName: "Pembayaran Penjahit", reason: "Penerima Sri Ratih" };
    }
    // 5. Marketplace payments paid via BRIVA.
    if (/BRIVA/.test(text) && /SHOPEE|TOKOPEDIA/.test(text)) {
      return { ...NONE, categoryName: "Ongkir", needsReview: true, reason: "BRIVA ke Shopee/Tokopedia" };
    }
    // 7. Fuel via QRIS.
    if (/QRIS/.test(text) && /SPBU/.test(text)) {
      return { ...NONE, categoryName: "Operasional Toko", reason: "QRIS SPBU" };
    }
    // 8. Bank fees.
    if (/BIAYA ADMIN|ADMIN FEE|MONTHLY FEE|BI-?FAST/.test(text)) {
      return { ...NONE, categoryName: "Biaya Bank", reason: "Biaya bank" };
    }
  } else if (/TOKOPEDIA/.test(text) || who.includes("TOKOPEDIA")) {
    // 6. TikTok settlements arrive from "Bank Lain - … - Tokopedia".
    return { ...NONE, categoryName: "Pencairan TikTok", reason: "Pencairan dari Tokopedia" };
  }

  return NONE;
}
