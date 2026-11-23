import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { BankImportForm } from "./bank-import-form";

export const dynamic = "force-dynamic";

export default async function BankImportPage() {
  const [accountList, categoryList] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)).orderBy(accounts.name),
    db.select({ id: categories.id, name: categories.name, kind: categories.kind }).from(categories).orderBy(categories.name),
  ]);

  return (
    <>
      <Header
        title="Impor Mutasi BRImo"
        subtitle="Unggah e-Statement CSV dari BRImo — sumber utama Arus Kas, bebas input manual."
      />
      <main className="flex-1 p-4 md:p-6">
        <BankImportForm accounts={accountList} categories={categoryList} />
      </main>
    </>
  );
}
