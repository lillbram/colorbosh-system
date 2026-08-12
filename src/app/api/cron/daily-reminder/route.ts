import { NextResponse, type NextRequest } from "next/server";
import { addDays, format } from "date-fns";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { purchaseOrders, suppliers, tailorPayments, productionBatches, users } from "@/db/schema";
import { getChannelBalances } from "@/lib/disbursement";
import { sendEmail, dailyReminderEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = format(new Date(), "yyyy-MM-dd");
  const twoDaysFromNow = format(addDays(new Date(), 2), "yyyy-MM-dd");

  const [overduePOs, overdueTermins, upcomingBatches, balances, owners] = await Promise.all([
    db
      .select({
        poNumber: purchaseOrders.poNumber,
        expectedDate: purchaseOrders.expectedDate,
        supplierName: suppliers.name,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .where(and(eq(purchaseOrders.status, "ordered"), lt(purchaseOrders.expectedDate, today))),
    db
      .select({
        terminNo: tailorPayments.terminNo,
        amount: tailorPayments.amount,
        batchCode: productionBatches.batchCode,
      })
      .from(tailorPayments)
      .innerJoin(productionBatches, eq(tailorPayments.batchId, productionBatches.id))
      .where(and(eq(tailorPayments.status, "due"), lt(tailorPayments.dueDate, today))),
    db
      .select({ batchCode: productionBatches.batchCode, targetFinishDate: productionBatches.targetFinishDate })
      .from(productionBatches)
      .where(
        and(
          eq(productionBatches.targetFinishDate, twoDaysFromNow),
          eq(productionBatches.isDeleted, false)
        )
      ),
    getChannelBalances(),
    db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.role, "owner"), eq(users.isActive, true))),
  ]);

  const eligiblePayouts = balances
    .filter((b) => b.outstanding > 0.5)
    .map((b) => ({ amount: String(b.outstanding), channelName: b.channelName as string | null }));

  const { subject, html } = dailyReminderEmail({
    overduePOs,
    overdueTermins,
    upcomingBatches,
    eligiblePayouts,
  });

  const recipients = owners.map((o) => o.email);
  const emailResult =
    recipients.length > 0 ? await sendEmail({ to: recipients, subject, html }) : { skipped: true };

  return NextResponse.json({
    date: today,
    overduePOs: overduePOs.length,
    overdueTermins: overdueTermins.length,
    upcomingBatches: upcomingBatches.length,
    eligiblePayouts: eligiblePayouts.length,
    emailResult,
  });
}
