import { pgTable, pgEnum, bigserial, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "restore",
]);

export const auditLogs = pgTable("audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  action: auditActionEnum("action").notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  diff: jsonb("diff"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow(),
});
