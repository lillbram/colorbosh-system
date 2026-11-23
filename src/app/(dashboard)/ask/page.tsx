import { Header } from "@/components/layout/header";
import { requireRole } from "@/lib/auth";
import { claudeEnabled } from "@/lib/claude";
import { AskChat } from "./ask-chat";

export const dynamic = "force-dynamic";

export default async function AskPage() {
  await requireRole("owner");
  return (
    <>
      <Header title="Tanya Keuangan" subtitle="Tanya angka bisnis dengan bahasa biasa. Hanya membaca data, tidak mengubah apa pun." />
      <main className="flex-1 p-4 md:p-6">
        <AskChat enabled={claudeEnabled()} />
      </main>
    </>
  );
}
