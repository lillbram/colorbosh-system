import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { claudeVisionEnabled } from "@/lib/receipt-claude";
import { getSignedProofUrl } from "@/lib/proof-storage";
import { ReceiptForm } from "./receipt-form";

export const dynamic = "force-dynamic";

const INBOX_RE = /^\d{4}\/\d{2}\/[\w-]+\.(jpg|png|webp)$/;

export default async function ReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ inbox?: string }>;
}) {
  const { inbox } = await searchParams;
  const inboxPath = inbox && INBOX_RE.test(inbox) ? inbox : null;

  const [accountList, categoryList, inboxUrl] = await Promise.all([
    db.select({ id: accounts.id, name: accounts.name }).from(accounts).where(eq(accounts.isActive, true)).orderBy(accounts.name),
    db.select({ id: categories.id, name: categories.name, kind: categories.kind }).from(categories).orderBy(categories.name),
    inboxPath ? getSignedProofUrl(inboxPath) : Promise.resolve(null),
  ]);

  return (
    <>
      <Header title="Upload Bukti Transfer" subtitle="Foto bukti transfer, data terisi otomatis, cek, lalu simpan." />
      <main className="flex-1 p-4 md:p-6">
        <ReceiptForm
          accounts={accountList}
          categories={categoryList}
          inbox={inboxPath && inboxUrl ? { path: inboxPath, url: inboxUrl } : null}
          readsWithClaude={claudeVisionEnabled()}
        />
      </main>
    </>
  );
}
