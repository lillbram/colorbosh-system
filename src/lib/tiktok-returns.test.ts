import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mapReturnStatus,
  parseJakartaDateTime,
  parseRupiah,
  parseTikTokReturnRow,
} from "./tiktok-returns";

test("parseRupiah handles Rp prefix and dot thousands", () => {
  assert.equal(parseRupiah("Rp54.048"), 54048);
  assert.equal(parseRupiah("Rp 1.250.000"), 1250000);
  assert.equal(parseRupiah("Rp0"), null);
  assert.equal(parseRupiah(""), null);
});

test("parseJakartaDateTime keeps wall time with +07:00", () => {
  assert.equal(parseJakartaDateTime("06/11/2026 16:18:50"), "2026-11-06T16:18:50+07:00");
  assert.equal(parseJakartaDateTime("6/1/2026"), "2026-01-06T00:00:00+07:00");
  assert.equal(parseJakartaDateTime("31/13/2026 10:00:00"), null);
  assert.equal(parseJakartaDateTime("nope"), null);
});

test("mapReturnStatus", () => {
  assert.equal(mapReturnStatus("Completed", ""), "completed");
  assert.equal(mapReturnStatus("To Process", ""), "processing");
  assert.equal(mapReturnStatus("To Process", "Request Canceled"), "rejected");
  assert.equal(mapReturnStatus("Refund rejected", ""), "rejected");
});

test("parseTikTokReturnRow keeps long IDs as text and multiplies unit price by qty", () => {
  const r = parseTikTokReturnRow({
    "Return Order ID": "4035746518630452345",
    "Order ID": "5784012345678901234",
    "Time Requested": "05/10/2026 09:30:00",
    "Refund Time": "09/10/2026 14:00:00",
    "Return Quantity": "2",
    "Return unit price": "Rp54.048",
    "Return Status": "Completed",
    "Return Sub Status": "",
    "Seller SKU": "CDG-KRH",
    "Product Name": "Cardigan Kerah",
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.row.externalReturnId, "4035746518630452345");
    assert.equal(r.row.refundAmount, 108096);
    assert.equal(r.row.status, "completed");
    assert.equal(r.row.refundedAt, "2026-10-09T14:00:00+07:00");
  }
});

test("parseTikTokReturnRow rejects scientific-notation IDs and bad quantity", () => {
  assert.equal(parseTikTokReturnRow({ "Return Order ID": "4.03575E+18" }).ok, false);
  const bad = parseTikTokReturnRow({
    "Return Order ID": "1",
    "Time Requested": "05/10/2026 09:30:00",
    "Return Quantity": "0",
    "Return unit price": "Rp1.000",
  });
  assert.equal(bad.ok, false);
});
