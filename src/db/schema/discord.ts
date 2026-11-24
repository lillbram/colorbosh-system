import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// Things the Discord bot proposed and is waiting for someone to confirm (/catat).
export const discordPending = pgTable("discord_pending", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").notNull(),
  payload: jsonb("payload").notNull(),
  discordUserId: text("discord_user_id").notNull(),
  status: text("status").notNull().default("pending"), // pending | done | cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});
