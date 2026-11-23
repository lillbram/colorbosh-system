import { pgTable, uuid, text, numeric, date, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { channels } from "./master";
import { users } from "./users";

// Manually entered balances shown in the marketplace seller center. See CLAUDE.md §6.9.
export const marketplaceBalanceSnapshots = pgTable(
  "marketplace_balance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    channelId: uuid("channel_id").references(() => channels.id),
    snapshotDate: date("snapshot_date").notNull(),
    awaitingDelivery: numeric("awaiting_delivery", { precision: 14, scale: 2 }).notNull().default("0"),
    settlementProcessing: numeric("settlement_processing", { precision: 14, scale: 2 }).notNull().default("0"),
    // Shown but not counted in Modal Berjalan (that money may go back to buyers).
    refundProcessing: numeric("refund_processing", { precision: 14, scale: 2 }).notNull().default("0"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [index("marketplace_snapshots_date_idx").on(t.snapshotDate)]
);

// "Tutup Buku": frozen numbers of a month. Edits inside a locked month are
// owner-only and leave an audit entry (src/lib/month-lock.ts).
export const monthClosings = pgTable("month_closings", {
  id: uuid("id").primaryKey().defaultRandom(),
  month: text("month").notNull().unique(),
  snapshot: jsonb("snapshot").notNull(),
  note: text("note"),
  closedAt: timestamp("closed_at", { withTimezone: true }).defaultNow(),
  closedBy: uuid("closed_by").references(() => users.id),
});
