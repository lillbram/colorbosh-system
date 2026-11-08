export type ParsedReceipt = {
  amount: number | null;
  txnDate: string | null;
  recipient: string | null;
  note: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, may: 5, jun: 6, jul: 7,
  agu: 8, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, des: 12, dec: 12,
};

function parseRupiah(raw: string): number | null {
  const cleaned = raw.replace(/,\d{1,2}$/, "").replace(/[^\d]/g, "");
  const n = Number(cleaned);
  return cleaned && n > 0 ? n : null;
}

function parseAmount(text: string, lines: string[]): number | null {
  const totalIdx = lines.findIndex((l) => /total\s*transaksi/i.test(l));
  if (totalIdx >= 0) {
    for (const l of lines.slice(totalIdx, totalIdx + 3)) {
      const m = l.match(/R[pP]\s?([\d.,]+)/);
      if (m) return parseRupiah(m[1]);
    }
  }
  const nominal = text.match(/nominal\s*:?\s*R[pP]\s?([\d.,]+)/i);
  if (nominal) return parseRupiah(nominal[1]);
  const any = text.match(/R[pP]\s?([\d.,]{4,})/);
  return any ? parseRupiah(any[1]) : null;
}

function parseDate(text: string): string | null {
  const m = text.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!month) return null;
  const day = Number(m[1]);
  if (day < 1 || day > 31) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseRecipient(lines: string[]): string | null {
  const idx = lines.findIndex((l) => /^tujuan\b/i.test(l));
  if (idx < 0) return null;
  for (const l of lines.slice(idx + 1, idx + 5)) {
    const name = l.replace(/^[^A-Za-z]*(?:[A-Z]{2}\s+)?/, "").trim();
    if (/^[A-Z][A-Z .'-]{3,}$/.test(name) && !/^BANK\b/.test(name)) return name;
  }
  return null;
}

function parseNote(lines: string[]): string | null {
  for (const l of lines) {
    const m = l.match(/^catatan\s*:?\s*(.*)$/i);
    if (m) return m[1].trim() || null;
  }
  return null;
}

export function parseBrimoReceipt(text: string): ParsedReceipt {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    amount: parseAmount(text, lines),
    txnDate: parseDate(text),
    recipient: parseRecipient(lines),
    note: parseNote(lines),
  };
}

export async function scanReceiptImage(file: File): Promise<ParsedReceipt> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ind+eng");
  try {
    const { data } = await worker.recognize(file);
    return parseBrimoReceipt(data.text);
  } finally {
    await worker.terminate();
  }
}
