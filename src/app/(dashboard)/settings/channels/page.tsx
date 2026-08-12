import { Store } from "lucide-react";
import { db } from "@/db";
import { channels } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ChannelFormDialog } from "./channel-form-dialog";

export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const data = await db.select().from(channels).orderBy(channels.name);

  return (
    <>
      <Header
        title="Channel Penjualan"
        subtitle="Kelola TikTok Live, TikTok Shop, Shopee, dan channel lain beserta fee & hold default."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <ChannelFormDialog />
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Store}
                title="Belum ada channel"
                description="Tambahkan TikTok Live, TikTok Shop, dan Shopee untuk mulai mencatat penjualan."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Fee Default</TableHead>
                  <TableHead>Hold Default</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono-num">{c.defaultFeePct}%</TableCell>
                    <TableCell className="font-mono-num">{c.defaultHoldDays} hari</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <ChannelFormDialog channel={c} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </main>
    </>
  );
}
