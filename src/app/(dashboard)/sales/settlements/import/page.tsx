import { db } from "@/db";
import { channels } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { SettlementImportForm } from "./settlement-import-form";

export const dynamic = "force-dynamic";

export default async function SettlementImportPage() {
  const channelList = await db.select({ id: channels.id, name: channels.name, type: channels.type }).from(channels).orderBy(channels.name);
  return (
    <>
      <Header
        title="Impor Fee TikTok"
        subtitle="Unggah laporan penyelesaian (Detail pesanan) supaya fee platform memakai angka sebenarnya."
      />
      <main className="flex-1 p-4 md:p-6">
        <SettlementImportForm channels={channelList} />
      </main>
    </>
  );
}
