import { pgTable, pgEnum, uuid, text, integer, date, timestamp, index } from "drizzle-orm/pg-core";
import { products } from "./master";
import { users } from "./users";

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "opening",
  "production_in",
  "sale_out",
  "return_in",
  "adjustment",
  "opname",
]);

// Current stock per product = Σ qty (signed). sale_out is written by the
// sales actions inside the same transaction as the sales row.
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    movementDate: date("movement_date").notNull(),
    type: stockMovementTypeEnum("type").notNull(),
    qty: integer("qty").notNull(),
    refType: text("ref_type"),
    refId: uuid("ref_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
  },
  (t) => [index("stock_movements_product_idx").on(t.productId), index("stock_movements_ref_idx").on(t.refType, t.refId)]
);
