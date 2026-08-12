import { sql } from "drizzle-orm";
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
import { suppliers } from "./master";
import { users } from "./users";

export const poStatusEnum = pgEnum("po_status", [
  "draft",
  "ordered",
  "partially_received",
  "received",
  "cancelled",
]);

export const poItemTypeEnum = pgEnum("po_item_type", [
  "fabric_roll",
  "accessory",
  "packaging",
  "other",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "transfer",
  "cash",
  "cod",
  "other",
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  poNumber: text("po_number").notNull().unique(),
  orderDate: date("order_date").notNull(),
  expectedDate: date("expected_date"),
  actualArrivalDate: date("actual_arrival_date"),
  status: poStatusEnum("status").default("draft"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});

export const purchaseOrderItems = pgTable("purchase_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  poId: uuid("po_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  itemType: poItemTypeEnum("item_type").notNull(),
  description: text("description").notNull(),
  qtyOrdered: numeric("qty_ordered", { precision: 10, scale: 2 }).notNull(),
  qtyReceived: numeric("qty_received", { precision: 10, scale: 2 }),
  unit: text("unit").default("pcs"),
  unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).generatedAlwaysAs(
    sql`qty_ordered * unit_price`
  ),
  notes: text("notes"),
});

export const purchaseOrderPayments = pgTable("purchase_order_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  poId: uuid("po_id")
    .references(() => purchaseOrders.id, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  paymentDate: date("payment_date").notNull(),
  method: paymentMethodEnum("method").notNull(),
  proofUrl: text("proof_url"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
});
