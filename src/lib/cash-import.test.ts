import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCashRows } from "./cash-import";

const accounts = [{ id: "a1", name: "Rekening Operasional - BRI" }];
const categories = [{ id: "c1", name: "Gaji" }];

test("valid row resolves names case-insensitively", () => {
  const [r] = resolveCashRows(
    [{ Tanggal: "18/08/2026", Arah: "keluar", Akun: "rekening operasional - bri", Kategori: "gaji", Keterangan: "Gaji", Nominal: "1.500.000" }],
    accounts,
    categories
  );
  assert.equal(r.valid, true);
  assert.equal(r.txnDate, "2026-08-18");
  assert.equal(r.amount, 1500000);
  assert.equal(r.accountId, "a1");
  assert.equal(r.categoryId, "c1");
});

test("bad rows say why", () => {
  const base = { Tanggal: "2026-08-18", Arah: "Masuk", Akun: "Rekening Operasional - BRI", Kategori: "", Keterangan: "x", Nominal: 5000 };
  const reason = (over: object) => resolveCashRows([{ ...base, ...over }], accounts, categories)[0].reason;
  assert.equal(reason({}), "");
  assert.match(reason({ Arah: "?" }), /Arah/);
  assert.match(reason({ Akun: "Lain" }), /akun/i);
  assert.match(reason({ Nominal: 0 }), /Nominal/);
  assert.match(reason({ Tanggal: "" }), /Tanggal/);
});
