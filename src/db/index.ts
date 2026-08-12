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
    // The session pooler caps out at 15 connections for the WHOLE Supabase
    // project — not just this app. On Vercel, each concurrent serverless
    // invocation can run in its own instance, and every instance gets its
    // own pool of up to `max` connections — so `max` bounds each instance's
    // budget, not the app's total. A handful of simultaneous requests across
    // a few instances at max:8 was enough to blow past 15 by itself. Kept
    // small (2) so several concurrent instances can coexist under the cap,
    // with headroom left for Supabase Studio, ad-hoc scripts, etc. Local dev
    // only ever runs one instance, so this doesn't hurt dev-time throughput
    // in practice.
    max: 2,
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

// Cache on `global` in every environment, not just dev. This survives
// Next.js HMR locally, and on Vercel it lets a warm serverless instance
// reuse the same connection pool across invocations instead of opening a
// fresh one (with its own max:8 connections) every time this module is
// re-evaluated — without this, concurrent requests could quickly blow past
// Supabase's 15-connection session-pooler cap for the whole project.
global.__postgresClient = client;

export const db = drizzle(client, { schema });
