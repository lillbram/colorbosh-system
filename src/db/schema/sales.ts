import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { channels, products } from "./master";
import { users } from "./users";

export const salesSourceEnum = pgEnum("sales_source", [
  "manual",
  "csv_import",
  "live_bulk",
  "pos",
]);

export const salesEntries = pgTable(
  "sales_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryDate: date("entry_date").notNull(),
    channelId: uuid("channel_id").references(() => channels.id),
    orderRef: text("order_ref"),
    productId: uuid("product_id").references(() => products.id),
    qty: integer("qty").notNull(),
    grossAmount: numeric("gross_amount", { precision: 12, scale: 2 }).notNull(),
    platformFeeEst: numeric("platform_fee_est", { precision: 12, scale: 2 }).default("0"),
    discount: numeric("discount", { precision: 12, scale: 2 }).default("0"),
    netExpected: numeric("net_expected", { precision: 12, scale: 2 }).generatedAlwaysAs(
      sql`gross_amount - platform_fee_est - discount`
    ),
    buyerNote: text("buyer_note"),
    source: salesSourceEnum("source").default("manual"),
    liveSessionId: uuid("live_session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    isDeleted: boolean("is_deleted").default(false),
    // Distinct from isDeleted: a retur is a post-delivery return of a
    // legitimately fulfilled order (goods shipped, arrived, then sent
    // back) — isDeleted is for pre-fulfillment mistakes/cancellations.
    // Both are excluded from revenue/stock/profit and disbursement
    // calculations, but shown separately in the UI since they mean
    // different things to the business. See CLAUDE.md §6.3.
    isReturned: boolean("is_returned").default(false),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    returnNote: text("return_note"),
  },
  // Scoped to (channel, order, product) rather than just (channel, order) —
  // one order_ref legitimately spans multiple rows when an order has more
  // than one distinct product (POS carts, multi-item CSV imports). The
  // narrower (channel, order) constraint this replaced rejected any such
  // order's 2nd+ product as a duplicate. See CLAUDE.md §6.3.
  (table) => [unique().on(table.channelId, table.orderRef, table.productId)]
);

export const salesLiveSessions = pgTable("sales_live_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionDate: date("session_date").notNull(),
  channelId: uuid("channel_id").references(() => channels.id),
  hostName: text("host_name"),
  totalOrders: integer("total_orders"),
  totalGross: numeric("total_gross", { precision: 14, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});

export const returnStatusEnum = pgEnum("return_status", ["processing", "completed", "rejected"]);
export const returnSourceEnum = pgEnum("return_source", ["tiktok_import", "manual"]);

// Partial/aggregate-safe returns. sales_entries.is_returned stays for legacy
// whole-row returns; new returns live here. See CLAUDE.md §6.3.
export const salesReturns = pgTable("sales_returns", {
  id: uuid("id").primaryKey().defaultRandom(),
  salesEntryId: uuid("sales_entry_id").references(() => salesEntries.id),
  channelId: uuid("channel_id").references(() => channels.id),
  productId: uuid("product_id").references(() => products.id),
  externalReturnId: text("external_return_id").unique(),
  externalOrderId: text("external_order_id"),
  requestedAt: timestamp("requested_at", { withTimezone: true }).notNull(),
  refundedAt: timestamp("refunded_at", { withTimezone: true }),
  qty: integer("qty").notNull(),
  refundAmount: numeric("refund_amount", { precision: 12, scale: 2 }).notNull(),
  // Snapshot of products.hpp_target at the time the return is recorded.
  hppPerUnit: numeric("hpp_per_unit", { precision: 12, scale: 2 }).notNull().default("0"),
  restock: boolean("restock").notNull().default(true),
  status: returnStatusEnum("status").notNull().default("processing"),
  reason: text("reason"),
  buyerNote: text("buyer_note"),
  source: returnSourceEnum("source").notNull().default("manual"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").notNull().default(false),
});
