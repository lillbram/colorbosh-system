import { after, NextResponse } from "next/server";
import { getPnL, getWorkingCapital } from "@/lib/finance";
import { isAllowed, verifyDiscordRequest } from "@/lib/discord";
import { prepareCatat, resolveCatat, type DiscordAttachment } from "@/lib/discord-catat";
import { formatIDR, formatDate } from "@/lib/format";
import { isValidMonth, monthLabel, monthRange, todayJakarta } from "@/lib/period";
import { getSaldoKas } from "@/lib/reports";
import { getLowStockThreshold, getStockLevels } from "@/lib/stock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Interaction = {
  type: number;
  guild_id?: string;
  channel_id?: string;
  member?: { user?: { id: string } };
  user?: { id: string };
  token?: string;
  application_id?: string;
  message?: { id: string };
  data?: {
    name?: string;
    custom_id?: string;
    options?: { name: string; value: string }[];
    resolved?: { attachments?: Record<string, DiscordAttachment> };
  };
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

  if ((i.type !== 2 && i.type !== 3) || !i.data) return reply("Perintah tidak dikenali.");
  const userId = i.member?.user?.id ?? i.user?.id;
  if (!isAllowed({ guildId: i.guild_id, channelId: i.channel_id, userId })) {
    return NextResponse.json({
      type: 4,
      data: { content: "Kamu belum diizinkan memakai perintah ini di channel ini.", flags: 64 },
    });
  }

  const appIdEarly = i.application_id ?? process.env.DISCORD_APP_ID;
  const tokenEarly = i.token;
  if (!tokenEarly || !appIdEarly) return reply("Permintaan tidak lengkap.");
  const edit = (payload: Record<string, unknown>) =>
    fetch(`https://discord.com/api/v10/webhooks/${appIdEarly}/${tokenEarly}/messages/@original`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed_mentions: { parse: [] }, ...payload }),
    });

  // Button on a /catat proposal: acknowledge silently, then replace the message.
  if (i.type === 3) {
    const [prefix, action, id] = (i.data.custom_id ?? "").split(":");
    if (prefix !== "catat" || (action !== "ok" && action !== "no") || !id || !userId) return reply("Tombol tidak dikenali.");
    after(async () => {
      let content: string;
      try {
        content = await resolveCatat(action, id, userId);
      } catch {
        content = "Gagal memproses, coba lagi.";
      }
      await edit({ content, components: [] });
    });
    return NextResponse.json({ type: 6 });
  }

  if (i.data.name === "catat") {
    const attId = i.data.options?.find((o) => o.name === "bukti")?.value;
    const att = attId ? i.data.resolved?.attachments?.[attId] : undefined;
    if (!att || !userId) return reply("Lampirkan foto bukti transfer.");
    after(async () => {
      let out: { content: string; components?: unknown[] };
      try {
        out = await prepareCatat(att, userId);
      } catch {
        out = { content: "Gagal membaca bukti, coba lagi." };
      }
      await edit(out);
    });
    return NextResponse.json({ type: 5 });
  }

  // Discord wants an answer within 3 seconds, so acknowledge now and edit the
  // message with the real result once the numbers are ready.
  const { options } = i.data;
  const name = i.data.name ?? "";

  after(async () => {
    let content: string;
    try {
      content = await run(name, options);
    } catch {
      content = "Gagal mengambil data, coba lagi sebentar lagi.";
    }
    await edit({ content });
  });
  return NextResponse.json({ type: 5 });
}

async function run(name: string, options?: { name: string; value: string }[]): Promise<string> {
  switch (name) {
    case "laba": {
      const given = options?.find((o) => o.name === "bulan")?.value;
      if (given && !isValidMonth(given)) return "Format bulan harus YYYY-MM, contoh 2026-11.";
      return laba(given ?? todayJakarta().slice(0, 7));
    }
    case "stok":
      return stok();
    case "kas":
      return kas();
    default:
      return "Perintah tidak dikenali.";
  }
}
