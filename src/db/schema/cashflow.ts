import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  numeric,
  date,
  timestamp,
} from "drizzle-orm/pg-core";
import { accounts, categories } from "./master";
import { users } from "./users";

export const cashDirectionEnum = pgEnum("cash_direction", ["in", "out"]);

export const cashRelatedTypeEnum = pgEnum("cash_related_type", [
  "po_payment",
  "tailor_payment",
  "payout",
  "manual",
]);

export const cashTransactions = pgTable("cash_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  txnDate: date("txn_date").notNull(),
  accountId: uuid("account_id").references(() => accounts.id),
  direction: cashDirectionEnum("direction").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  relatedType: cashRelatedTypeEnum("related_type"),
  relatedId: uuid("related_id"),
  description: text("description"),
  proofUrl: text("proof_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});
