import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { NewPoForm } from "./new-po-form";

export const dynamic = "force-dynamic";

export default async function NewProcurementPage() {
  const supplierList = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.isDeleted, false))
    .orderBy(suppliers.name);

  return (
    <>
      <Header title="Pemesanan Kain Baru" subtitle="Catat pemesanan kain, hiasan, atau plastik packing ke supplier." />
      <main className="flex-1 p-6">
        <NewPoForm suppliers={supplierList} />
      </main>
    </>
  );
}
