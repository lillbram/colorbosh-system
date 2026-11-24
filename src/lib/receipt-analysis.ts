import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, cashTransactions, categories } from "@/db/schema";
import { suggestCategory } from "@/lib/cash-rules";
import { getOldestUnpaidSalaryMonth } from "@/lib/finance";
import { todayJakarta } from "@/lib/period";
import type { ExtractedReceipt } from "@/lib/receipt-parser";

export type ReceiptAnalysis = {
  categoryId: string | null;
  categoryName: string | null;
  periodMonth: string | null;
  needsReview: boolean;
  reason: string;
  accountId: string | null;
  duplicate: { id: string; txnDate: string; amount: number; description: string | null } | null;
};

export async function analyze(r: ExtractedReceipt): Promise<ReceiptAnalysis> {
  const counterparty = r.direction === "out" ? r.recipientName : r.senderName;
  const rule = suggestCategory(
    {
      direction: r.direction,
      counterparty,
      note: r.note,
      description: r.transactionType,
      recipientAccount: r.recipientAccount,
    },
    todayJakarta()
  );

  const [categoryRows, accountRows, dupRows] = await Promise.all([
    rule.categoryName
      ? db
          .select({ id: categories.id, name: categories.name })
          .from(categories)
          .where(eq(categories.name, rule.categoryName))
      : Promise.resolve([]),
    db.select({ id: accounts.id }).from(accounts).where(eq(accounts.isActive, true)),
    r.bankRef
      ? db
          .select({
            id: cashTransactions.id,
            txnDate: cashTransactions.txnDate,
            amount: cashTransactions.amount,
            description: cashTransactions.description,
          })
          .from(cashTransactions)
          .where(and(eq(cashTransactions.bankRef, r.bankRef), eq(cashTransactions.isDeleted, false)))
      : Promise.resolve([]),
  ]);

  let periodMonth = rule.periodMonth;
  if (rule.categoryName === "Gaji" && !periodMonth && rule.allocateOldestUnpaid) {
    periodMonth = await getOldestUnpaidSalaryMonth();
  }

  return {
    categoryId: categoryRows[0]?.id ?? null,
    categoryName: categoryRows[0] ? rule.categoryName : null,
    periodMonth,
    needsReview: rule.needsReview,
    reason: rule.reason,
    accountId: accountRows.length === 1 ? accountRows[0].id : null,
    duplicate: dupRows[0]
      ? {
          id: dupRows[0].id,
          txnDate: dupRows[0].txnDate,
          amount: Number(dupRows[0].amount),
          description: dupRows[0].description,
        }
      : null,
  };
}

