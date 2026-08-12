import { Users as UsersIcon } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
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
import { CreateUserDialog } from "./create-user-dialog";
import { ToggleActiveSwitch } from "./toggle-active-switch";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [data, actorId] = await Promise.all([
    db.select().from(users).orderBy(users.name),
    getCurrentUserId(),
  ]);

  const actor = data.find((u) => u.id === actorId);
  const isOwner = actor?.role === "owner";

  return (
    <>
      <Header
        title="Pengguna"
        subtitle="Daftar owner dan admin yang punya akses ke sistem."
      />

      <main className="flex-1 space-y-4 p-6">
        <div className="flex justify-end">
          {isOwner ? (
            <CreateUserDialog />
          ) : (
            <p className="text-sm text-muted">Hanya Owner yang bisa menambah pengguna baru.</p>
          )}
        </div>

        <Card>
          {data.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={UsersIcon}
                title="Belum ada pengguna"
                description="Buat akun owner pertama lewat halaman login/sign up."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Peran</TableHead>
                  <TableHead>Status</TableHead>
                  {isOwner && <TableHead className="w-24 text-right">Aktif</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === "owner" ? "default" : "neutral"}>
                        {u.role === "owner" ? "Owner" : "Admin"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "success" : "danger"}>
                        {u.isActive ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <ToggleActiveSwitch userId={u.id} isActive={u.isActive ?? true} />
                      </TableCell>
                    )}
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
