import { and, eq } from "drizzle-orm";
import { format } from "date-fns";
import { db } from "@/db";
import { products, channels, salesEntries } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { PosClient } from "./pos-client";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const today = format(new Date(), "yyyy-MM-dd");

  const [productList, channelList, todayRows] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        basePrice: products.basePrice,
        hppTarget: products.hppTarget,
      })
      .from(products)
      .where(and(eq(products.isDeleted, false), eq(products.isActive, true)))
      .orderBy(products.name),
    db.select({ id: channels.id, name: channels.name }).from(channels).orderBy(channels.name),
    db
      .select({
        orderRef: salesEntries.orderRef,
        channelName: channels.name,
        productName: products.name,
        qty: salesEntries.qty,
        grossAmount: salesEntries.grossAmount,
        createdAt: salesEntries.createdAt,
      })
      .from(salesEntries)
      .leftJoin(channels, eq(salesEntries.channelId, channels.id))
      .leftJoin(products, eq(salesEntries.productId, products.id))
      .where(
        and(
          eq(salesEntries.source, "pos"),
          eq(salesEntries.entryDate, today),
          eq(salesEntries.isDeleted, false)
        )
      ),
  ]);

  const productsWithCost = productList.map((p) => ({
    ...p,
    avgCost: Number(p.hppTarget ?? 0),
  }));

  const ordersByRef = new Map<
    string,
    {
      orderRef: string;
      channelName: string | null;
      createdAt: string;
      items: { productName: string; qty: number; grossAmount: number }[];
      total: number;
    }
  >();

  for (const row of todayRows) {
    if (!row.orderRef) continue;
    const existing = ordersByRef.get(row.orderRef);
    const item = {
      productName: row.productName ?? "-",
      qty: row.qty,
      grossAmount: Number(row.grossAmount),
    };
    if (existing) {
      existing.items.push(item);
      existing.total += item.grossAmount;
    } else {
      ordersByRef.set(row.orderRef, {
        orderRef: row.orderRef,
        channelName: row.channelName,
        createdAt: row.createdAt?.toISOString() ?? new Date().toISOString(),
        items: [item],
        total: item.grossAmount,
      });
    }
  }

  const todayOrders = Array.from(ordersByRef.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <>
      <Header title="Kasir (POS)" subtitle="Klik produk untuk menambah ke order, lalu simpan." />
      <main className="flex-1 p-6">
        <PosClient products={productsWithCost} channels={channelList} todayOrders={todayOrders} />
      </main>
    </>
  );
}
