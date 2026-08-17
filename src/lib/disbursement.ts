import { and, eq } from "drizzle-orm";
import { differenceInCalendarDays } from "date-fns";
import { db } from "@/db";
import { salesEntries, payouts, channels } from "@/db/schema";

export type ChannelBalance = {
  channelId: string;
  channelName: string;
  totalSold: number;
  totalReceived: number;
  outstanding: number;
  oldestUnpaidDate: string | null;
  oldestUnpaidDays: number | null;
};

/**
 * Per-channel running balance: total penjualan aktif dikurangi total
 * pencairan yang sudah diterima. Menggantikan model "expectation batch"
 * lama yang mencoba mencocokkan payout ke transaksi tertentu — platform
 * tidak memberi rincian order per payout, jadi kepastian itu tidak pernah
 * benar-benar ada. `oldestUnpaidDate` adalah estimasi FIFO (transaksi
 * tertua yang dianggap belum tercakup oleh total yang sudah diterima),
 * dipakai untuk aging saja, bukan klaim kepastian. Lihat CLAUDE.md §6.4.
 */
export async function getChannelBalances(): Promise<ChannelBalance[]> {
  const [channelList, entries, payoutRows] = await Promise.all([
    // Channels with requiresDisbursement=false (e.g. "Paket Usaha") settle
    // instantly at sale time — see createManualSale/createLiveSession/
    // createPosOrder, which auto-post a cash_transaction for them instead.
    // They're excluded here entirely so they never show a fake "Belum Cair"
    // balance. See CLAUDE.md §6.4.
    db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(eq(channels.requiresDisbursement, true)),
    db
      .select({
        channelId: salesEntries.channelId,
        entryDate: salesEntries.entryDate,
        netExpected: salesEntries.netExpected,
      })
      .from(salesEntries)
      .where(and(eq(salesEntries.isDeleted, false), eq(salesEntries.isReturned, false))),
    db
      .select({ channelId: payouts.channelId, actualAmount: payouts.actualAmount })
      .from(payouts)
      .where(eq(payouts.isDeleted, false)),
  ]);

  const soldByChannel = new Map<string, { total: number; entries: { date: string; amount: number }[] }>();
  for (const e of entries) {
    if (!e.channelId) continue;
    const bucket = soldByChannel.get(e.channelId) ?? { total: 0, entries: [] };
    bucket.total += Number(e.netExpected);
    bucket.entries.push({ date: e.entryDate, amount: Number(e.netExpected) });
    soldByChannel.set(e.channelId, bucket);
  }

  const receivedByChannel = new Map<string, number>();
  for (const p of payoutRows) {
    if (!p.channelId) continue;
    receivedByChannel.set(p.channelId, (receivedByChannel.get(p.channelId) ?? 0) + Number(p.actualAmount));
  }

  const today = new Date();

  return channelList.map((c) => {
    const sold = soldByChannel.get(c.id);
    const totalSold = sold?.total ?? 0;
    const totalReceived = receivedByChannel.get(c.id) ?? 0;
    const outstanding = totalSold - totalReceived;

    let oldestUnpaidDate: string | null = null;
    if (sold && outstanding > 0) {
      const sortedEntries = [...sold.entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      let covered = totalReceived;
      for (const entry of sortedEntries) {
        if (covered >= entry.amount) {
          covered -= entry.amount;
        } else {
          oldestUnpaidDate = entry.date;
          break;
        }
      }
    }

    return {
      channelId: c.id,
      channelName: c.name,
      totalSold,
      totalReceived,
      outstanding,
      oldestUnpaidDate,
      oldestUnpaidDays: oldestUnpaidDate ? differenceInCalendarDays(today, new Date(oldestUnpaidDate)) : null,
    };
  });
}
