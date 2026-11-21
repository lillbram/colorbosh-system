/**
 * Pure P&L math, no DB. Keep every formula here so Dashboard, Laporan and
 * Penjualan can't drift apart — see docs/COLORBOSH_DEV_SPEC.md §3.
 */

export type SaleRow = {
  productId: string | null;
  channelId: string | null;
  qty: number;
  gross: number;
  discount: number;
  fee: number;
  net: number;
};

export type CashOutRow = { amount: number; categoryName: string | null };

export type ReturnRow = { refundAmount: number; qty: number; hppPerUnit: number; restock: boolean };

/** Cash-out categories that are production cost or owner draws, not operating expenses. */
export const NON_OPEX_CATEGORIES = ["Gaji", "Bagi Hasil", "Prive", "Pembayaran Penjahit", "Bahan"];

export function isOpex(categoryName: string | null): boolean {
  return !categoryName || !NON_OPEX_CATEGORIES.includes(categoryName);
}

/** Refund minus the HPP recovered when the returned goods go back to stock. */
export function returnLoss(rows: ReturnRow[]): number {
  return rows.reduce(
    (sum, r) => sum + r.refundAmount - (r.restock ? r.hppPerUnit * r.qty : 0),
    0
  );
}

export function computePnL(input: {
  sales: SaleRow[];
  hppById: Map<string, number>;
  cashOut: CashOutRow[];
  returnLoss?: number;
}) {
  const { sales, hppById, cashOut } = input;
  const totalPenjualan = sales.reduce((s, r) => s + r.gross, 0);
  const totalDiskon = sales.reduce((s, r) => s + r.discount, 0);
  const totalFeePlatform = sales.reduce((s, r) => s + r.fee, 0);
  const totalBersih = sales.reduce((s, r) => s + r.net, 0);
  const hpp = sales.reduce(
    (s, r) => s + (r.productId ? (hppById.get(r.productId) ?? 0) : 0) * r.qty,
    0
  );
  const labaKotor = totalBersih - hpp;
  const rugiRetur = input.returnLoss ?? 0;
  const totalOperasional = cashOut.filter((r) => isOpex(r.categoryName)).reduce((s, r) => s + r.amount, 0);
  const labaBersih = labaKotor - rugiRetur - totalOperasional;

  return {
    totalPenjualan,
    totalDiskon,
    totalFeePlatform,
    totalBersih,
    hpp,
    labaKotor,
    rugiRetur,
    totalOperasional,
    labaBersih,
  };
}
