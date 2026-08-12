import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  let bootstrapOpen = false;
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    bootstrapOpen = existing.length === 0;
  } catch {
    // Fail closed: if we can't verify no users exist yet, don't risk
    // showing the owner-creation form.
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex-col items-start gap-1 pt-6">
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
          C
        </div>
        <h1 className="text-h2 text-ink">
          {bootstrapOpen ? "Buat Akun Owner Pertama" : "Pendaftaran Ditutup"}
        </h1>
        <p className="text-sm text-muted">
          {bootstrapOpen
            ? "Akun ini akan menjadi Owner dengan akses penuh ke sistem."
            : "Sudah ada akun terdaftar. Hubungi owner untuk diundang lewat halaman Pengaturan > Pengguna."}
        </p>
      </CardHeader>
      <CardContent>
        {bootstrapOpen ? (
          <SignupForm />
        ) : (
          <Link
            href="/login"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary-500 text-sm font-medium text-white hover:bg-primary-600"
          >
            Ke Halaman Masuk
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
