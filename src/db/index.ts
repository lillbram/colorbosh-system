import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
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
    // budget, not the app's total. Kept at 1: Vercel functions can go
    // "frozen" between requests rather than shutting down, and JS timers
    // (including this client's own idle_timeout) don't run while frozen —
    // so a burst of traffic can leave several frozen-but-warm instances each
    // still holding connections open indefinitely, with nothing to release
    // them until Vercel eventually tears the instance down. max:1 bounds
    // the worst case per instance to a single held connection. Local dev
    // only ever runs one instance, so this doesn't hurt dev-time throughput.
    max: 1,
    connect_timeout: 10,
    idle_timeout: 10,
    max_lifetime: 60 * 5,
    // NOTE: intentionally no `connection: { statement_timeout, ... }` here.
    // Verified directly against production: Supabase's session pooler
    // silently drops both custom startup parameters AND the standard
    // libpq `options=-c key=value` mechanism — neither actually reaches
    // the backend. `SHOW statement_timeout` still comes back as Supabase's
    // default (2min) no matter what's configured here. The only mechanism
    // that verifiably works through this pooler is issuing real `SET`/`SET
    // LOCAL` statements as queries — see `withTransaction()` below.
  });

// Cache on `global` in every environment, not just dev. This survives
// Next.js HMR locally, and on Vercel it lets a warm serverless instance
// reuse the same connection pool across invocations instead of opening a
// fresh one (with its own max:8 connections) every time this module is
// re-evaluated — without this, concurrent requests could quickly blow past
// Supabase's 15-connection session-pooler cap for the whole project.
global.__postgresClient = client;

export const db = drizzle(client, { schema });

/**
 * Use instead of `db.transaction()` directly for every write. Applies
 * `SET LOCAL` timeouts as the first statements inside the transaction —
 * `SET LOCAL` is scoped to just this transaction and auto-reverts at
 * commit/rollback, so it's safe to set here without leaking into other
 * concurrent work on a shared connection. See the note in this file for why
 * connection-level config doesn't reach the backend through Supabase's
 * pooler; this is the mechanism that actually works. Protects specifically
 * against the failure mode observed in production: a Vercel function
 * freezing mid-transaction, leaving it "idle in transaction" and holding
 * row locks indefinitely until something else force-aborts it.
 */
export async function withTransaction<T>(fn: (tx: typeof db) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL statement_timeout = 15000`);
    await tx.execute(sql`SET LOCAL idle_in_transaction_session_timeout = 15000`);
    return fn(tx as unknown as typeof db);
  });
}
