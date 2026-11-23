import { test } from "node:test";
import assert from "node:assert/strict";
import { monthFromToken, suggestCategory } from "./cash-rules";

const TODAY = "2026-11-23";
const base = { direction: "out" as const, counterparty: null, note: null };

test("note prefix wins and GAJI-NOV names the month", () => {
  const r = suggestCategory({ ...base, counterparty: "SHINTHYA INDRIA YANA", note: "GAJI-NOV" }, TODAY);
  assert.equal(r.categoryName, "Gaji");
  assert.equal(r.periodMonth, "2026-11");
  assert.equal(r.allocateOldestUnpaid, false);
  assert.equal(suggestCategory({ ...base, note: "JAHIT minggu 3" }, TODAY).categoryName, "Pembayaran Penjahit");
  assert.equal(suggestCategory({ ...base, note: "OPS-listrik" }, TODAY).categoryName, "Operasional Toko");
});

test("a month later than today means last year", () => {
  assert.equal(monthFromToken("DES", "2026-11-23"), "2025-12");
  assert.equal(monthFromToken("OKT", "2026-11-23"), "2026-10");
  assert.equal(monthFromToken("XXX", "2026-11-23"), null);
});

test("transfer to Shinthya: 'gajian' is Gaji (oldest unpaid), otherwise a draft Operasional", () => {
  const gaji = suggestCategory({ ...base, counterparty: "SHINTHYA INDRIA YANA", note: "gajian shintya" }, TODAY);
  assert.equal(gaji.categoryName, "Gaji");
  assert.equal(gaji.allocateOldestUnpaid, true);
  const other = suggestCategory({ ...base, counterparty: "SHINTHYA INDRIA YANA", note: "pembayaran retur" }, TODAY);
  assert.equal(other.categoryName, "Operasional Toko");
  assert.equal(other.needsReview, true);
});

test("tailor by name or account number", () => {
  assert.equal(suggestCategory({ ...base, counterparty: "SRI RATIH" }, TODAY).categoryName, "Pembayaran Penjahit");
  assert.equal(
    suggestCategory({ ...base, counterparty: "X", note: null, ...{ recipientAccount: "5245 1102 32".replace(/ /g, "") } }, TODAY)
      .categoryName,
    "Pembayaran Penjahit"
  );
});

test("statement-style descriptions", () => {
  assert.equal(
    suggestCategory({ ...base, description: "BRIVA ke SHOPEE 123" }, TODAY).categoryName,
    "Ongkir"
  );
  assert.equal(suggestCategory({ ...base, description: "QRIS PT PERTAMINA SPBU 34" }, TODAY).categoryName, "Operasional Toko");
  assert.equal(suggestCategory({ ...base, description: "Biaya admin BI-Fast" }, TODAY).categoryName, "Biaya Bank");
  assert.equal(
    suggestCategory({ direction: "in", counterparty: null, note: null, description: "Bank Lain - 207678920099 - Tokopedia" }, TODAY)
      .categoryName,
    "Pencairan TikTok"
  );
});

test("no rule matches → no suggestion", () => {
  assert.equal(suggestCategory({ ...base, counterparty: "BUDI", note: "beli kardus" }, TODAY).categoryName, null);
});
