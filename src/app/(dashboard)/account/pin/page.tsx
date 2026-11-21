import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userPins } from "@/db/schema";
import { Header } from "@/components/layout/header";
import { getCurrentUserId } from "@/lib/auth";
import { lockEnabled } from "@/lib/lock-cookie";
import { PinForm } from "./pin-form";

export const dynamic = "force-dynamic";

export default async function PinPage() {
  const userId = await getCurrentUserId();
  const [row] = userId
    ? await db.select({ userId: userPins.userId }).from(userPins).where(eq(userPins.userId, userId))
    : [];

  return (
    <>
      <Header title="Kunci PIN" subtitle="Kunci aplikasi dengan PIN 6 angka di perangkat ini." />
      <main className="flex-1 p-4 md:p-6">
        <PinForm hasPin={!!row} enabled={lockEnabled()} />
      </main>
    </>
  );
}
