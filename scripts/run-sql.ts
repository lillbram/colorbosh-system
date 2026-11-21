/** Runs a SQL file against DATABASE_URL.  npx tsx scripts/run-sql.ts supabase/phase2.sql */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: run-sql.ts <file.sql>");
  const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
  await sql.unsafe(readFileSync(file, "utf8"));
  console.log("OK:", file);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
