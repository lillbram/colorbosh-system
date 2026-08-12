import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tailors, products, productionCostComponents } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { NewBatchForm } from "./new-batch-form";

export const dynamic = "force-dynamic";

export default async function NewProductionBatchPage() {
  const [tailorList, productList, costComponentList] = await Promise.all([
    db
      .select({
        id: tailors.id,
        name: tailors.name,
        defaultTermin1Pct: tailors.defaultTermin1Pct,
      })
      .from(tailors)
      .where(eq(tailors.isDeleted, false))
      .orderBy(tailors.name),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.isDeleted, false))
      .orderBy(products.name),
    db
      .select({
        id: productionCostComponents.id,
        name: productionCostComponents.name,
        category: productionCostComponents.category,
        unit: productionCostComponents.unit,
        unitCost: productionCostComponents.unitCost,
      })
      .from(productionCostComponents)
      .where(
        and(eq(productionCostComponents.isDeleted, false), eq(productionCostComponents.isActive, true))
      )
      .orderBy(productionCostComponents.category, productionCostComponents.name),
  ]);

  return (
    <>
      <Header title="Batch Produksi Baru" subtitle="Buat batch produksi baru dan atur termin pembayaran penjahit." />
      <main className="flex-1 p-6">
        <NewBatchForm tailors={tailorList} products={productList} costComponents={costComponentList} />
      </main>
    </>
  );
}
