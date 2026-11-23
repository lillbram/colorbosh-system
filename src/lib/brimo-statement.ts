/**
 * Parser for the BRImo e-Statement CSV export (columns: ID, NOREK, TGL_TRAN,
 * TGL_EFEKTIF, JAM_TRAN, SEQ, DESK_TRAN, SALDO_AWAL_MUTASI, MUTASI_DEBET,
 * MUTASI_KREDIT, SALDO_AKHIR_MUTASI, GLSIGN, TRUSER, KODE_TRAN, KODE_TRAN_TELLER,
 * TRREMK, TLBDS1, TLBDS2, REMARK_CUSTOM). Pure, no DB. The exact date/number
 * formats are not fixed by the spec, so both are parsed tolerantly; anything
 * unreadable becomes an invalid row in the preview instead of a wrong one.
 */

export type StatementRow = {
  /** Dedupe key stored in cash_transactions.bank_ref. */
  key: string;
  txnDate: string;
  time: string;
  direction: "in" | "out";
  amount: number;
  description: string;
  /** REMARK_CUSTOM — the user's own transfer note. */
  note: string | null;
  balanceAfter: number | null;
  /** Sort key for finding the latest row, whatever order the file is in. */
  order: string;
};

/** "1.250.000,00" / "1,250,000.00" / "1250000" → 1250000. Null when it is not a number. */
export function parseMoney(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  let s = String(raw ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandSep = decimalSep === "." ? "," : ".";
    s = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    s = /,\d{1,2}$/.test(s) && s.indexOf(",") === lastComma ? s.replace(",", ".") : s.split(",").join("");
  } else if (lastDot >= 0) {
    s = /\.\d{1,2}$/.test(s) && s.indexOf(".") === lastDot ? s : s.split(".").join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** dd/MM/yyyy, dd-MM-yy, yyyy-MM-dd, yyyyMMdd or a JS Date → "yyyy-MM-dd". */
export function parseStatementDate(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${raw.getUTCFullYear()}-${p(raw.getUTCMonth() + 1)}-${p(raw.getUTCDate())}`;
  }
  const s = String(raw ?? "").trim();
  const pad = (v: string) => v.padStart(2, "0");
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) return valid(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4}|\d{2})/);
  if (m) return valid(m[3].length === 2 ? `20${m[3]}` : m[3], m[2], m[1]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return valid(m[1], m[2], m[3]);
  return null;

  function valid(y: string, mo: string, d: string): string | null {
    const month = Number(mo);
    const day = Number(d);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${pad(String(month))}-${pad(String(day))}`;
  }
}

function pick(rec: Record<string, unknown>, name: string): string {
  const key = Object.keys(rec).find((k) => k.trim().toUpperCase() === name);
  return key !== undefined && rec[key] != null ? String(rec[key]).trim() : "";
}

export function parseStatementRow(
  rec: Record<string, unknown>
): { ok: true; row: StatementRow } | { ok: false; error: string } {
  const norek = pick(rec, "NOREK");
  const txnDate = parseStatementDate(pick(rec, "TGL_TRAN"));
  if (!txnDate) return { ok: false, error: "TGL_TRAN tidak valid" };

  const debit = parseMoney(pick(rec, "MUTASI_DEBET")) ?? 0;
  const credit = parseMoney(pick(rec, "MUTASI_KREDIT")) ?? 0;
  if (debit <= 0 && credit <= 0) return { ok: false, error: "Mutasi debet/kredit kosong" };
  if (debit > 0 && credit > 0) return { ok: false, error: "Debet dan kredit terisi sekaligus" };

  const gl = pick(rec, "GLSIGN").toLowerCase();
  const direction: "in" | "out" = gl.startsWith("c") || gl.startsWith("k") ? "in" : gl.startsWith("d") ? "out" : debit > 0 ? "out" : "in";
  if ((direction === "out" && debit <= 0) || (direction === "in" && credit <= 0)) {
    return { ok: false, error: "GLSIGN tidak cocok dengan kolom mutasi" };
  }

  const seq = pick(rec, "SEQ");
  const time = pick(rec, "JAM_TRAN");
  const remark = pick(rec, "REMARK_CUSTOM");
  const description = [pick(rec, "DESK_TRAN"), remark || pick(rec, "TRREMK")].filter(Boolean).join(" · ") || "Mutasi BRImo";

  return {
    ok: true,
    row: {
      key: `brimo:${norek}|${txnDate}|${seq}|${debit}|${credit}`,
      txnDate,
      time,
      direction,
      amount: direction === "out" ? debit : credit,
      description,
      note: remark || null,
      balanceAfter: parseMoney(pick(rec, "SALDO_AKHIR_MUTASI")),
      order: `${txnDate}|${time.padStart(8, "0")}|${seq.padStart(8, "0")}`,
    },
  };
}

/** Closing balance of the latest transaction in the file, whatever the row order. */
export function finalBalance(rows: StatementRow[]): number | null {
  const withBalance = rows.filter((r) => r.balanceAfter !== null);
  if (withBalance.length === 0) return null;
  return withBalance.reduce((latest, r) => (r.order > latest.order ? r : latest)).balanceAfter;
}
