export type ParsedReceipt = {
  amount: number | null;
  txnDate: string | null;
  recipient: string | null;
  note: string | null;
};

/** Full extraction shape shared by the Claude vision path and the OCR fallback. */
export type ExtractedReceipt = {
  /** "YYYY-MM-DDTHH:MM:SS" (Jakarta wall time) or just the date part when the time is unreadable. */
  datetime: string | null;
  amount: number | null;
  adminFee: number;
  direction: "in" | "out";
  senderName: string | null;
  recipientName: string | null;
  recipientBank: string | null;
  recipientAccount: string | null;
  bankRef: string | null;
  note: string | null;
  transactionType: string | null;
  /** 0..1; OCR results are capped lower than model results. */
  confidence: number;
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

function parseTime(text: string): string | null {
  const m = text.match(/\b([01]?\d|2[0-3]):([0-5]\d):([0-5]\d)\b/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}:${m[3]}` : null;
}

const NAME_AFTER_HEADER = /^[A-Z][A-Z .'-]{3,}$/;

function nameAfter(lines: string[], header: RegExp): { name: string; index: number } | null {
  const idx = lines.findIndex((l) => header.test(l));
  if (idx < 0) return null;
  for (let i = idx + 1; i < Math.min(lines.length, idx + 5); i++) {
    const name = lines[i].replace(/^[^A-Za-z]*(?:[A-Z]{2}\s+)?/, "").trim();
    if (NAME_AFTER_HEADER.test(name) && !/^BANK\b/.test(name)) return { name, index: i };
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

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export function parseBrimoReceipt(text: string): ParsedReceipt {
  const lines = splitLines(text);
  return {
    amount: parseAmount(text, lines),
    txnDate: parseDate(text),
    recipient: nameAfter(lines, /^tujuan\b/i)?.name ?? null,
    note: parseNote(lines),
  };
}

/** OCR fallback: everything the dialog needs, including bank ref and admin fee. */
export function parseBrimoReceiptFull(text: string): ExtractedReceipt {
  const lines = splitLines(text);
  const date = parseDate(text);
  const time = parseTime(text);
  const recipient = nameAfter(lines, /^tujuan\b/i);
  const sender = nameAfter(lines, /^sumber\s*dana\b/i);

  let recipientBank: string | null = null;
  let recipientAccount: string | null = null;
  if (recipient) {
    for (const l of lines.slice(recipient.index, recipient.index + 4)) {
      const bank = l.match(/BANK\s*[A-Z]+/i);
      if (bank && !recipientBank) recipientBank = bank[0].replace(/BANK\s*/i, "BANK ").toUpperCase();
      const acct = l.match(/^\D*(\d[\d ]{8,}\d)\s*$/);
      if (acct && !recipientAccount) recipientAccount = acct[1].replace(/\s/g, "");
    }
  }

  // OCR often reads a zero as the letter O ("RpO").
  const fee = text.match(/biaya\s*admin\s*:?\s*R[pP]\s?([\dOo.,]+)/i);
  const adminFee = fee ? (parseRupiah(fee[1].replace(/[Oo]/g, "0")) ?? 0) : 0;
  const ref = text.match(/no\.?\s*ref\s*:?\s*(\d{8,})/i);
  const type = text.match(/jenis\s*transaksi\s*:?\s*(.+)/i);

  const amount = parseAmount(text, lines);
  const found = [amount, date, recipient, ref].filter(Boolean).length;

  return {
    datetime: date ? (time ? `${date}T${time}` : date) : null,
    amount,
    adminFee,
    direction: "out",
    senderName: sender?.name ?? null,
    recipientName: recipient?.name ?? null,
    recipientBank,
    recipientAccount,
    bankRef: ref ? ref[1] : null,
    note: parseNote(lines),
    transactionType: type ? type[1].trim() : null,
    confidence: Math.min(0.7, found * 0.2),
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

export async function scanReceiptImageFull(file: File | Blob): Promise<ExtractedReceipt> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ind+eng");
  try {
    const { data } = await worker.recognize(file);
    return parseBrimoReceiptFull(data.text);
  } finally {
    await worker.terminate();
  }
}
