import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cashTransactions } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth";
import { getSignedProofUrl } from "@/lib/proof-storage";

/** Signed-in users only: redirects to a 5-minute signed URL for the transaction's proof photo. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentUserId())) return NextResponse.redirect(new URL("/login", request.url));

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const [row] = await db
    .select({ proofUrl: cashTransactions.proofUrl })
    .from(cashTransactions)
    .where(eq(cashTransactions.id, id));
  if (!row?.proofUrl) return new NextResponse("Bukti tidak ada", { status: 404 });

  const url = await getSignedProofUrl(row.proofUrl);
  if (!url) return new NextResponse("Bukti tidak bisa dibuka", { status: 404 });
  return NextResponse.redirect(url);
}
