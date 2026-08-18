import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, products, accounts } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { ManualSaleForm } from "./manual-sale-form";

export const dynamic = "force-dynamic";

export default async function ManualSalePage() {
  const [channelList, productList, accountList] = await Promise.all([
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({ id: products.id, name: products.name, basePrice: products.basePrice, hppTarget: products.hppTarget })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)),
  ]);

  const productsWithCost = productList.map((p) => ({
    ...p,
    avgCost: Number(p.hppTarget ?? 0),
  }));

  return (
    <>
      <Header title="Input Penjualan Manual" subtitle="Untuk order sporadis atau koreksi data." />
      <main className="flex-1 p-6">
        <ManualSaleForm channels={channelList} products={productsWithCost} accounts={accountList} />
      </main>
    </>
  );
}
