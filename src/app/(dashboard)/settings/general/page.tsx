import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { requireRole } from "@/lib/auth";
import { GeneralForm } from "./general-form";

export const dynamic = "force-dynamic";

export default async function GeneralSettingsPage() {
  await requireRole("owner");
  const [row] = await db.select().from(settings).where(eq(settings.id, 1));
  return (
    <>
      <Header title="Pengaturan Umum" subtitle="Persen gaji, cadangan, dan batas stok menipis." />
      <main className="flex-1 p-4 md:p-6">
        <GeneralForm
          initial={{
            salaryPct: Number(row?.salaryPct ?? 1) * 100,
            returnReservePct: Number(row?.returnReservePct ?? 0),
            capitalReservePct: Number(row?.capitalReservePct ?? 0),
            lowStockThreshold: row?.lowStockThreshold ?? 10,
          }}
        />
      </main>
    </>
  );
}
