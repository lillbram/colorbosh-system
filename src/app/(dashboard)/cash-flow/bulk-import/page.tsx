import { db } from "@/db";
import { accounts, categories } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { BulkImportForm } from "./bulk-import-form";

export const dynamic = "force-dynamic";

export default async function CashFlowBulkImportPage() {
  const [accountList, categoryList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).orderBy(accounts.name),
    db
      .select({ id: categories.id, name: categories.name, kind: categories.kind })
      .from(categories)
      .orderBy(categories.name),
  ]);

  return (
    <>
      <Header
        title="Impor Transaksi Kas"
        subtitle="Unduh template Excel, isi transaksinya, lalu unggah lagi untuk mencatat sekaligus."
      />
      <main className="flex-1 p-6">
        <BulkImportForm accounts={accountList} categories={categoryList} />
      </main>
    </>
  );
}
