import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, products } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { LiveSessionForm } from "./live-session-form";

export const dynamic = "force-dynamic";

export default async function NewLiveSessionPage() {
  const [channelList, productList] = await Promise.all([
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({ id: products.id, name: products.name, basePrice: products.basePrice, hppTarget: products.hppTarget })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
  ]);

  const productsWithCost = productList.map((p) => ({
    ...p,
    avgCost: Number(p.hppTarget ?? 0),
  }));

  return (
    <>
      <Header title="Rekap Live" subtitle="Input massal penjualan dari satu sesi TikTok Live." />
      <main className="flex-1 p-6">
        <LiveSessionForm channels={channelList} products={productsWithCost} />
      </main>
    </>
  );
}
