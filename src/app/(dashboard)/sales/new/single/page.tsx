import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, products } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { ManualSaleForm } from "./manual-sale-form";

export const dynamic = "force-dynamic";

export default async function ManualSalePage() {
  const [channelList, productList] = await Promise.all([
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({ id: products.id, name: products.name, basePrice: products.basePrice })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
  ]);

  return (
    <>
      <Header title="Input Penjualan Manual" subtitle="Untuk order sporadis atau koreksi data." />
      <main className="flex-1 p-6">
        <ManualSaleForm channels={channelList} products={productList} />
      </main>
    </>
  );
}
