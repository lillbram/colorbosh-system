import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const suppliers = pgTable("suppliers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});

export const tailors = pgTable("tailors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  phone: text("phone"),
  defaultTermin1Pct: integer("default_termin_1_pct").default(50),
  defaultLeadTimeDays: integer("default_lead_time_days").default(7),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  category: text("category"),
  basePrice: numeric("base_price", { precision: 12, scale: 2 }),
  hppTarget: numeric("hpp_target", { precision: 12, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});

export const channelTypeEnum = pgEnum("channel_type", [
  "tiktok_live",
  "tiktok_shop",
  "shopee",
  "other",
]);

export const channels = pgTable("channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: channelTypeEnum("type").notNull(),
  defaultFeePct: numeric("default_fee_pct", { precision: 5, scale: 2 }),
  defaultHoldDays: integer("default_hold_days"),
  // false for channels where payment is received directly at sale time (e.g.
  // "Paket Usaha") — such channels are excluded from Pencairan Dana's Belum
  // Cair tracking entirely, and recording a sale for one immediately posts a
  // matching cash_transaction instead of waiting for a platform payout.
  // Default true (TikTok/Shopee-style: sale now, payout later). See §6.4.
  requiresDisbursement: boolean("requires_disbursement").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const categoryKindEnum = pgEnum("category_kind", ["income", "expense"]);

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  kind: categoryKindEnum("kind").notNull(),
  isSystem: boolean("is_system").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const accountTypeEnum = pgEnum("account_type", ["bank", "cash", "e_wallet"]);

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const costComponentCategoryEnum = pgEnum("cost_component_category", [
  "fabric",
  "accessory",
  "packaging",
  "labor",
  "other",
]);

export const productionCostComponents = pgTable("production_cost_components", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  category: costComponentCategoryEnum("category").notNull(),
  unit: text("unit").notNull().default("pcs"),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  createdBy: uuid("created_by").references(() => users.id),
  isDeleted: boolean("is_deleted").default(false),
});
