import { test } from "node:test";
import assert from "node:assert/strict";
import { allocateFee, parsePaidDate, parseSettlementRows } from "./tiktok-settlement";

const row = (order: string, fee: string) => {
  const cells: string[] = Array(16).fill("");
  cells[0] = order;
  cells[3] = "2026/10/05";
  cells[5] = "48.000";
  cells[7] = "51.000";
  cells[14] = fee;
  return cells;
};

test("only rows with a long numeric order id are data; fee is stored as a positive number", () => {
  const rows = parseSettlementRows([
    ["Order/adjustment ID", "", "", "Payment time"],
    row("5784012345678901234", "-3.000"),
    ["Total", "", ""],
  ]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].orderRef, "5784012345678901234");
  assert.equal(rows[0].fee, 3000);
  assert.equal(rows[0].subtotal, 51000);
  assert.equal(rows[0].paidDate, "2026-10-05");
});

test("parsePaidDate", () => {
  assert.equal(parsePaidDate("2026/10/05"), "2026-10-05");
  assert.equal(parsePaidDate("2026-1-5 10:00"), "2026-01-05");
  assert.equal(parsePaidDate("garbage"), null);
});

test("allocateFee splits by gross and always sums to the fee", () => {
  const parts = allocateFee(3000, [51000, 102000, 51000]);
  assert.equal(parts.reduce((a, b) => a + b, 0), 3000);
  assert.deepEqual(allocateFee(1000, [1, 1, 1]).reduce((a, b) => a + b, 0), 1000);
  assert.deepEqual(allocateFee(500, [0, 0]), [500, 0]);
  assert.deepEqual(allocateFee(500, []), []);
});
