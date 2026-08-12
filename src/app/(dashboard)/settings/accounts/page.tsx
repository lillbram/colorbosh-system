import { Landmark } from "lucide-react";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { formatIDR } from "@/lib/format";
import { AccountFormDialog } from "./account-form-dialog";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  bank: "Rekening Bank",
  cash: "Kas Tunai",
  e_wallet: "E-Wallet",
};

export default async function AccountsPage() {
  const data = await db.select().from(accounts).orderBy(accounts.name);

  return (
    <>
      <Header title="Akun Kas & Bank" subtitle="Kelola rekening bank, kas tunai, dan e-wallet." />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          <AccountFormDialog />
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Landmark}
                title="Belum ada akun"
                description="Tambahkan rekening bank, kas tunai, atau e-wallet untuk mulai mencatat arus kas."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Saldo Awal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell>{TYPE_LABEL[a.type]}</TableCell>
                    <TableCell className="font-mono-num">
                      {formatIDR(Number(a.openingBalance))}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.isActive ? "success" : "neutral"}>
                        {a.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <AccountFormDialog account={a} />
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
