import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  let bootstrapOpen = false;
  try {
    const existing = await db.select({ id: users.id }).from(users).limit(1);
    bootstrapOpen = existing.length === 0;
  } catch {
    // If the bootstrap check fails (e.g. transient DB hiccup), fall back to
    // hiding the signup link rather than blocking the login form entirely.
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="flex-col items-start gap-1 pt-6">
        <div className="mb-2 flex size-10 items-center justify-center rounded-full bg-primary-500 text-sm font-semibold text-white">
          C
        </div>
        <h1 className="text-h2 text-ink">Masuk ke Cardigan Biz</h1>
        <p className="text-sm text-muted">
          Kelola pengadaan, produksi, penjualan, dan kas dalam satu tempat.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <LoginForm />
        {bootstrapOpen && (
          <p className="text-center text-sm text-muted">
            Belum ada akun?{" "}
            <Link href="/signup" className="font-medium text-primary-600 hover:underline">
              Buat akun owner pertama
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
