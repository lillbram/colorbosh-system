import { eq } from "drizzle-orm";
import { db } from "@/db";
import { channels, productAliases, products } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { ReturnImportForm } from "./return-import-form";

export const dynamic = "force-dynamic";

export default async function ImportReturnsPage() {
  const [channelList, productList, aliasList] = await Promise.all([
    db.select({ id: channels.id, name: channels.name, type: channels.type }).from(channels).orderBy(channels.name),
    db
      .select({ id: products.id, name: products.name, sku: products.sku })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
    db.select({ alias: productAliases.alias, productId: productAliases.productId }).from(productAliases),
  ]);

  return (
    <>
      <Header
        title="Impor Retur TikTok"
        subtitle="Unggah file Pesanan yang Barang & Dananya Dikembalikan dari Seller Center."
      />
      <main className="flex-1 p-4 md:p-6">
        <ReturnImportForm channels={channelList} products={productList} aliases={aliasList} />
      </main>
    </>
  );
}
