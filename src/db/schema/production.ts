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
} from "drizzle-orm/pg-core";
import { tailors, products, productionCostComponents } from "./master";
import { purchaseOrders, paymentMethodEnum } from "./procurement";
import { users } from "./users";

export const batchStatusEnum = pgEnum("batch_status", [
  "planned",
  "in_progress",
  "finished",
  "delivered",
]);

export const productionBatches = pgTable("production_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchCode: text("batch_code").notNull().unique(),
  tailorId: uuid("tailor_id").references(() => tailors.id),
  poIdSource: uuid("po_id_source").references(() => purchaseOrders.id),
  fabricSource: text("fabric_source").default("from_po"),
  fabricUsedMeters: numeric("fabric_used_meters", { precision: 8, scale: 2 }),
  startDate: date("start_date").notNull(),
  targetFinishDate: date("target_finish_date").notNull(),
  actualFinishDate: date("actual_finish_date"),
  targetQty: integer("target_qty").notNull(),
  actualQty: integer("actual_qty"),
  status: batchStatusEnum("status").default("planned"),
  hppPerUnitCalc: numeric("hpp_per_unit_calc", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});

export const productionBatchProducts = pgTable("production_batch_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .references(() => productionBatches.id, { onDelete: "cascade" })
    .notNull(),
  productId: uuid("product_id").references(() => products.id),
  qty: integer("qty").notNull(),
  // Filled per-product when the batch is marked finished — defaults to `qty`
  // but editable per line. Without this, "actual output" only existed as one
  // aggregate number for the whole batch, which made per-product stock
  // tracking impossible for multi-product batches. See CLAUDE.md §6.2.
  actualQty: integer("actual_qty"),
});

// Persisted breakdown of a batch's estimated production cost — replaces the
// old "scratch calculator that copies one number over" flow. Each row is
// either a catalog cost component (costComponentId set, qty × unitCost =
// subtotal) or a freeform "Biaya Tambahan" entry (isAdditional = true,
// qty/unitCost null, subtotal typed directly). See CLAUDE.md §6.2.
export const productionBatchCostItems = pgTable("production_batch_cost_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .references(() => productionBatches.id, { onDelete: "cascade" })
    .notNull(),
  costComponentId: uuid("cost_component_id").references(() => productionCostComponents.id),
  label: text("label").notNull(),
  qty: numeric("qty", { precision: 10, scale: 2 }),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  isAdditional: boolean("is_additional").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const tailorPaymentStatusEnum = pgEnum("tailor_payment_status", [
  "pending",
  "due",
  "paid",
  "overdue",
]);

export const tailorPayments = pgTable("tailor_payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: uuid("batch_id")
    .references(() => productionBatches.id, { onDelete: "cascade" })
    .notNull(),
  terminNo: integer("termin_no").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  dueDate: date("due_date"),
  paidDate: date("paid_date"),
  method: paymentMethodEnum("method"),
  proofUrl: text("proof_url"),
  status: tailorPaymentStatusEnum("status").default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
