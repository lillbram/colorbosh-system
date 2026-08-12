import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  date,
  jsonb,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { channels } from "./master";
import { salesEntries } from "./sales";
import { users } from "./users";

// DEPRECATED (see CLAUDE.md §6.4): the app no longer writes to this table.
// Disbursement used to be modeled as discrete "expectation" batches that a
// payout had to match (by channel+period, later by channel alone) — but the
// app can never actually know which sales a given platform payout covers
// (TikTok/Shopee don't expose order-level remittance detail), so trying to
// force a match was fake precision. The model was replaced with a live
// running balance per channel (`getChannelBalances()` in
// src/lib/disbursement.ts): outstanding = total terjual − total diterima,
// computed on the fly from `sales_entries` and `payouts`, no batch/matching
// step required. This table (and `payout_status` enum) is kept only so
// historical rows already in the database remain readable — do not insert
// into it from new code.
export const payoutStatusEnum = pgEnum("payout_status", [
  "projected",
  "eligible",
  "requested",
  "received",
  "discrepancy",
  "cancelled",
]);

export const payoutExpectations = pgTable("payout_expectations", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  expectedAmount: numeric("expected_amount", { precision: 14, scale: 2 }).notNull(),
  expectedPayoutDate: date("expected_payout_date"),
  status: payoutStatusEnum("status").default("eligible"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const payouts = pgTable("payouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => channels.id),
  actualDate: date("actual_date").notNull(),
  actualAmount: numeric("actual_amount", { precision: 14, scale: 2 }).notNull(),
  bankRef: text("bank_ref"),
  // Legacy link to payout_expectations — no longer populated, see note above.
  expectationId: uuid("expectation_id").references(() => payoutExpectations.id),
  feesDetail: jsonb("fees_detail"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});

export const payoutSalesLink = pgTable("payout_sales_link", {
  id: uuid("id").primaryKey().defaultRandom(),
  payoutId: uuid("payout_id")
    .references(() => payouts.id, { onDelete: "cascade" })
    .notNull(),
  salesEntryId: uuid("sales_entry_id").references(() => salesEntries.id),
  allocatedAmount: numeric("allocated_amount", { precision: 12, scale: 2 }).notNull(),
});
