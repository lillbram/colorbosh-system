import { test } from "node:test";
import assert from "node:assert/strict";
import { computePnL, isOpex, returnLoss, type SaleRow } from "./finance-calc";

const sale = (productId: string, qty: number, net: number): SaleRow => ({
  productId,
  channelId: "c1",
  qty,
  gross: net,
  discount: 0,
  fee: 0,
  net,
});

test("laba kotor = bersih - HPP, HPP not subtracted twice", () => {
  const r = computePnL({
    sales: [sale("a", 10, 500_000), sale("b", 2, 200_000)],
    hppById: new Map([
      ["a", 30_000],
      ["b", 60_000],
    ]),
    cashOut: [],
  });
  assert.equal(r.totalBersih, 700_000);
  assert.equal(r.hpp, 420_000);
  assert.equal(r.labaKotor, 280_000);
  assert.equal(r.labaBersih, 280_000);
});

test("laba bersih subtracts return loss and operasional only", () => {
  const r = computePnL({
    sales: [sale("a", 10, 1_000_000)],
    hppById: new Map([["a", 40_000]]),
    cashOut: [
      { amount: 50_000, categoryName: "Listrik" },
      { amount: 70_000, categoryName: null },
      { amount: 6_000_000, categoryName: "Gaji" },
      { amount: 1_000_000, categoryName: "Pembayaran Penjahit" },
    ],
    returnLoss: 25_000,
  });
  assert.equal(r.totalOperasional, 120_000);
  assert.equal(r.labaKotor, 600_000);
  assert.equal(r.labaBersih, 600_000 - 25_000 - 120_000);
});

test("isOpex excludes production and owner-draw categories", () => {
  for (const c of ["Gaji", "Bagi Hasil", "Prive", "Pembayaran Penjahit", "Bahan"]) {
    assert.equal(isOpex(c), false);
  }
  assert.equal(isOpex("Ongkir"), true);
  assert.equal(isOpex(null), true);
});

test("returnLoss: restocked returns recover HPP, others lose the full refund", () => {
  assert.equal(
    returnLoss([
      { refundAmount: 54_048, qty: 1, hppPerUnit: 50_000, restock: true },
      { refundAmount: 54_048, qty: 1, hppPerUnit: 50_000, restock: false },
    ]),
    4_048 + 54_048
  );
});
