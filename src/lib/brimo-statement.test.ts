import { test } from "node:test";
import assert from "node:assert/strict";
import { finalBalance, parseMoney, parseStatementDate, parseStatementRow } from "./brimo-statement";

test("parseMoney handles Indonesian and US separators", () => {
  assert.equal(parseMoney("1.250.000,00"), 1250000);
  assert.equal(parseMoney("1,250,000.00"), 1250000);
  assert.equal(parseMoney("1250000"), 1250000);
  assert.equal(parseMoney("2.500"), 2500);
  assert.equal(parseMoney("2,500"), 2500);
  assert.equal(parseMoney("54048.00"), 54048);
  assert.equal(parseMoney("Rp 165.000"), 165000);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("abc"), null);
});

test("parseStatementDate accepts the common export formats", () => {
  assert.equal(parseStatementDate("20/11/2026"), "2026-11-20");
  assert.equal(parseStatementDate("20-11-26"), "2026-11-20");
  assert.equal(parseStatementDate("2026-11-20"), "2026-11-20");
  assert.equal(parseStatementDate("20261120"), "2026-11-20");
  assert.equal(parseStatementDate("31/13/2026"), null);
  assert.equal(parseStatementDate("nope"), null);
});

const rec = (over: Record<string, string>) => ({
  NOREK: "013901012345503",
  TGL_TRAN: "20/11/2026",
  JAM_TRAN: "13:14:21",
  SEQ: "7",
  DESK_TRAN: "TRANSFER BI-FAST",
  MUTASI_DEBET: "165.000,00",
  MUTASI_KREDIT: "0,00",
  SALDO_AKHIR_MUTASI: "1.000.000,00",
  GLSIGN: "Db",
  REMARK_CUSTOM: "gajian shintya",
  ...over,
});

test("debit row becomes Uang Keluar with a stable dedupe key", () => {
  const r = parseStatementRow(rec({}));
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.row.direction, "out");
    assert.equal(r.row.amount, 165000);
    assert.equal(r.row.key, "brimo:013901012345503|2026-11-20|7|165000|0");
    assert.equal(r.row.note, "gajian shintya");
  }
});

test("credit row becomes Uang Masuk; fee row with the same SEQ gets its own key", () => {
  const credit = parseStatementRow(rec({ MUTASI_DEBET: "0,00", MUTASI_KREDIT: "2.000.000,00", GLSIGN: "Cr" }));
  assert.ok(credit.ok && credit.row.direction === "in" && credit.row.amount === 2000000);
  const transfer = parseStatementRow(rec({}));
  const fee = parseStatementRow(rec({ MUTASI_DEBET: "2.500,00", DESK_TRAN: "BIAYA ADMIN BI-FAST" }));
  assert.ok(transfer.ok && fee.ok);
  if (transfer.ok && fee.ok) assert.notEqual(transfer.row.key, fee.row.key);
});

test("bad rows are reported, not guessed", () => {
  assert.equal(parseStatementRow(rec({ TGL_TRAN: "??" })).ok, false);
  assert.equal(parseStatementRow(rec({ MUTASI_DEBET: "0", MUTASI_KREDIT: "0" })).ok, false);
  assert.equal(parseStatementRow(rec({ MUTASI_KREDIT: "5.000,00" })).ok, false);
});

test("finalBalance picks the latest row whatever the file order", () => {
  const a = parseStatementRow(rec({ SEQ: "1", SALDO_AKHIR_MUTASI: "500.000,00" }));
  const b = parseStatementRow(rec({ SEQ: "2", SALDO_AKHIR_MUTASI: "335.000,00" }));
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.equal(finalBalance([b.row, a.row]), 335000);
    assert.equal(finalBalance([a.row, b.row]), 335000);
  }
});
