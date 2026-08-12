import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

declare global {
  var __postgresClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global.__postgresClient ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    // The session pooler caps out at 15 connections for the whole project —
    // leave headroom for Supabase Studio, ad-hoc scripts, etc. rather than
    // letting the app claim the entire budget.
    max: 8,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    // Belt-and-suspenders against queries that hang indefinitely on the
    // Supabase side (observed: individual SELECTs stuck in "active" state
    // for minutes with no natural timeout) — force Postgres itself to
    // cancel anything that runs longer than 15s, turning a silent hang
    // into a catchable error instead of blocking the request forever.
    connection: {
      statement_timeout: 15000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  global.__postgresClient = client;
}

export const db = drizzle(client, { schema });
