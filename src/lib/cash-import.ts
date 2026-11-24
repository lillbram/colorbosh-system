export const TEMPLATE_HEADERS = [
  "Tanggal",
  "Arah",
  "Akun",
  "Kategori",
  "Keterangan",
  "Nominal",
];

export type ResolvedRow = {
  txnDate: string;
  direction: "in" | "out" | null;
  accountId: string | null;
  accountRaw: string;
  categoryId: string | null;
  categoryRaw: string;
  description: string;
  amount: number;
  valid: boolean;
  reason: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseTanggal(value: unknown): string {
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
  }
  const str = String(value ?? "").trim();
  const dmy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const [, y, m, d] = ymd;
    return `${y}-${pad2(Number(m))}-${pad2(Number(d))}`;
  }
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`;
  }
  return "";
}

function parseArah(value: unknown): "in" | "out" | null {
  const str = String(value ?? "")
    .trim()
    .toLowerCase();
  if (str === "masuk" || str === "in") return "in";
  if (str === "keluar" || str === "out") return "out";
  return null;
}

function parseNominal(value: unknown): number {
  if (typeof value === "number") return value;
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

/** Validates template rows against the real account / category names. Pure, shared by the web form and the Discord bot. */
export function resolveCashRows(
  rawRows: Record<string, unknown>[],
  accounts: { id: string; name: string }[],
  categories: { id: string; name: string }[],
): ResolvedRow[] {
  const accountByName = new Map(
    accounts.map((a) => [a.name.toLowerCase().trim(), a.id]),
  );
  const categoryByName = new Map(
    categories.map((c) => [c.name.toLowerCase().trim(), c.id]),
  );
  return rawRows.map((row) => {
    const txnDate = parseTanggal(row["Tanggal"]);
    const direction = parseArah(row["Arah"]);
    const accountRaw = String(row["Akun"] ?? "").trim();
    const accountId = accountByName.get(accountRaw.toLowerCase()) ?? null;
    const categoryRaw = String(row["Kategori"] ?? "").trim();
    const categoryId = categoryRaw
      ? (categoryByName.get(categoryRaw.toLowerCase()) ?? null)
      : null;
    const description = String(row["Keterangan"] ?? "").trim();
    const amount = parseNominal(row["Nominal"]);

    let reason = "";
    if (!txnDate) reason = "Tanggal tidak valid";
    else if (!direction) reason = 'Arah harus "Masuk" atau "Keluar"';
    else if (!accountRaw) reason = "Akun kosong";
    else if (!accountId) reason = "Nama akun tidak ditemukan";
    else if (categoryRaw && !categoryId)
      reason = "Nama kategori tidak ditemukan";
    else if (!description) reason = "Keterangan kosong";
    else if (!(amount > 0)) reason = "Nominal harus lebih dari 0";

    return {
      txnDate,
      direction,
      accountId,
      accountRaw,
      categoryId,
      categoryRaw,
      description,
      amount,
      valid: reason === "",
      reason,
    };
  });
}
