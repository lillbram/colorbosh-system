import { Header } from "@/components/layout/header";
import { todayJakarta } from "@/lib/period";
import { getStockLevels } from "@/lib/stock";
import { OpnameForm } from "./opname-form";

export const dynamic = "force-dynamic";

export default async function OpnamePage() {
  const levels = await getStockLevels();
  return (
    <>
      <Header title="Stock Opname" subtitle="Hitung stok fisik, lihat selisih, lalu konfirmasi." />
      <main className="flex-1 p-4 md:p-6">
        <OpnameForm
          today={todayJakarta()}
          items={levels
            .filter((l) => l.hasOpening)
            .map((l) => ({ productId: l.productId, name: l.name, sku: l.sku, system: l.qty }))}
          missingOpening={levels.filter((l) => !l.hasOpening).map((l) => l.name)}
        />
      </main>
    </>
  );
}
