import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, products } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { CsvImportForm } from "./csv-import-form";

export const dynamic = "force-dynamic";

export default async function ImportSalesPage() {
  const [channelList, productList] = await Promise.all([
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
  ]);

  return (
    <>
      <Header
        title="Impor Penjualan"
        subtitle="Unggah file export dari TikTok Shop atau Shopee, lalu cocokkan kolomnya."
      />
      <main className="flex-1 p-6">
        <CsvImportForm channels={channelList} products={productList} />
      </main>
    </>
  );
}
