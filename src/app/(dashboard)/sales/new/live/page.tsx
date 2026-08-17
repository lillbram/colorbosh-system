import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, products, accounts } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { LiveSessionForm } from "./live-session-form";

export const dynamic = "force-dynamic";

export default async function NewLiveSessionPage() {
  const [channelList, productList, accountList] = await Promise.all([
    db
      .select({ id: channels.id, name: channels.name, requiresDisbursement: channels.requiresDisbursement })
      .from(channels)
      .orderBy(channels.name),
    db
      .select({ id: products.id, name: products.name, basePrice: products.basePrice })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)),
  ]);

  return (
    <>
      <Header title="Rekap Live" subtitle="Input massal penjualan dari satu sesi TikTok Live." />
      <main className="flex-1 p-6">
        <LiveSessionForm channels={channelList} products={productList} accounts={accountList} />
      </main>
    </>
  );
}
