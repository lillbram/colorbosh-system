import { NextResponse } from "next/server";
import { getPnL, getWorkingCapital } from "@/lib/finance";
import { isAllowed, verifyDiscordRequest } from "@/lib/discord";
import { formatIDR, formatDate } from "@/lib/format";
import { isValidMonth, monthLabel, monthRange, todayJakarta } from "@/lib/period";
import { getSaldoKas } from "@/lib/reports";
import { getLowStockThreshold, getStockLevels } from "@/lib/stock";

export const dynamic = "force-dynamic";

type Interaction = {
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: { user?: { id: string } };
  user?: { id: string };
  data?: { name: string; options?: { name: string; value: string }[] };
};

const reply = (content: string) => NextResponse.json({ type: 4, data: { content, allowed_mentions: { parse: [] } } });

async function laba(month: string) {
  const r = monthRange(month);
  const p = await getPnL(r.start, r.end);
  return [
    `**Laporan ${monthLabel(month)}**`,
    `Penjualan: ${formatIDR(p.totalPenjualan)}`,
    `Penjualan bersih: ${formatIDR(p.totalBersih)}`,
    `HPP: ${formatIDR(p.hpp)}`,
    `Laba kotor: ${formatIDR(p.labaKotor)}`,
    `Rugi retur: ${formatIDR(p.rugiRetur)}`,
    `Operasional: ${formatIDR(p.totalOperasional)}`,
    `**Laba bersih: ${formatIDR(p.labaBersih)}**`,
  ].join("\n");
}

async function stok() {
  const [levels, threshold] = await Promise.all([getStockLevels(), getLowStockThreshold()]);
  const total = levels.reduce((s, l) => s + l.qty, 0);
  const lines = levels
    .filter((l) => l.qty <= threshold)
    .map((l) => `• ${l.name}: ${l.qty}${l.qty <= 0 ? " (habis)" : " (menipis)"}`);
  return [`**Stok** — total ${total} pcs`, lines.length ? lines.join("\n") : "Tidak ada produk yang menipis."].join("\n");
}

async function kas() {
  const [k, w] = await Promise.all([getSaldoKas(), getWorkingCapital(todayJakarta())]);
  return [
    `**Kas & modal**`,
    `Saldo kas: ${formatIDR(k.saldo)}${k.lastTxnDate ? ` (terakhir dicatat ${formatDate(k.lastTxnDate)})` : ""}`,
    `Saldo marketplace: ${formatIDR(w.marketplace)}`,
    `Nilai stok: ${formatIDR(w.stockValue)}`,
    `Sisa gaji: ${formatIDR(w.salaryRemaining)}`,
    `**Modal berjalan: ${formatIDR(w.total)}**`,
  ].join("\n");
}

export async function POST(request: Request) {
  const body = await request.text();
  const ok = verifyDiscordRequest(
    body,
    request.headers.get("x-signature-ed25519"),
    request.headers.get("x-signature-timestamp"),
    process.env.DISCORD_PUBLIC_KEY
  );
  if (!ok) return new NextResponse("invalid request signature", { status: 401 });

  const i = JSON.parse(body) as Interaction;
  if (i.type === 1) return NextResponse.json({ type: 1 }); // PING

  if (i.type !== 2 || !i.data) return reply("Perintah tidak dikenali.");
  const userId = i.member?.user?.id ?? i.user?.id;
  if (!isAllowed({ guildId: i.guild_id, channelId: i.channel_id, userId })) {
    return NextResponse.json({
      type: 4,
      data: { content: "Kamu belum diizinkan memakai perintah ini di channel ini.", flags: 64 },
    });
  }

  try {
    switch (i.data.name) {
      case "laba": {
        const given = i.data.options?.find((o) => o.name === "bulan")?.value;
        if (given && !isValidMonth(given)) return reply("Format bulan harus YYYY-MM, contoh 2026-11.");
        return reply(await laba(given ?? todayJakarta().slice(0, 7)));
      }
      case "stok":
        return reply(await stok());
      case "kas":
        return reply(await kas());
      default:
        return reply("Perintah tidak dikenali.");
    }
  } catch {
    return reply("Gagal mengambil data, coba lagi sebentar lagi.");
  }
}
