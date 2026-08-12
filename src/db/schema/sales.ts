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
  },
  (table) => [unique().on(table.channelId, table.orderRef)]
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
