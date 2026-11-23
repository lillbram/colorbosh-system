import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBrimoReceiptFull } from "./receipt-parser";

// Real OCR output of a BRImo "Transaksi Berhasil" screenshot (note the "RpO" for Rp0).
const BRIMO_OCR = `Transaksi Berhasil
06 November 2026, 16:18:50 WIB
Total Transaksi
No. Ref 246715296750
Sumber Dana

ABRAHAM BOB ELLSON L.M

BANK BRI

0139 *hkkk kkkk 503

Tujuan
SHINTHYA INDRIA YANA
SY  BANKBRI

0139 0123 7659 506
Jenis Transaksi Transfer Bank BRI
Catatan pembayaran retur
Nominal Rp30.000
Biaya Admin RpO
INFORMASI:`;

test("parseBrimoReceiptFull reads ref, time, fee, recipient bank and account", () => {
  const r = parseBrimoReceiptFull(BRIMO_OCR);
  assert.equal(r.amount, 30000);
  assert.equal(r.datetime, "2026-11-06T16:18:50");
  assert.equal(r.bankRef, "246715296750");
  assert.equal(r.adminFee, 0);
  assert.equal(r.direction, "out");
  assert.equal(r.senderName, "ABRAHAM BOB ELLSON L.M");
  assert.equal(r.recipientName, "SHINTHYA INDRIA YANA");
  assert.equal(r.recipientAccount, "013901237659506");
  assert.equal(r.note, "pembayaran retur");
  assert.equal(r.transactionType, "Transfer Bank BRI");
  assert.ok(r.confidence > 0.5);
});

test("a non-receipt gives low confidence and no amount", () => {
  const r = parseBrimoReceiptFull("hello world");
  assert.equal(r.amount, null);
  assert.equal(r.datetime, null);
  assert.ok(r.confidence < 0.3);
});
