/**
 * Idempotent: inserts missing system categories (docs/COLORBOSH_DEV_SPEC.md §2).
 * Never edits or deletes existing rows.
 *   npx tsx scripts/seed-categories.ts          # dry run
 *   npx tsx scripts/seed-categories.ts --apply  # write
 */
import { config } from "dotenv";

config({ path: ".env.local" });

const WANTED: { name: string; kind: "income" | "expense" }[] = [
  { name: "Gaji", kind: "expense" },
  { name: "Bagi Hasil", kind: "expense" },
  { name: "Prive", kind: "expense" },
  { name: "Bahan", kind: "expense" },
  { name: "Ongkir", kind: "expense" },
  { name: "Iklan", kind: "expense" },
  { name: "Biaya Bank", kind: "expense" },
  { name: "Pembayaran Penjahit", kind: "expense" },
  { name: "Pencairan TikTok", kind: "income" },
  { name: "Pencairan Shopee", kind: "income" },
  { name: "Setoran Grosir", kind: "income" },
  { name: "Modal Masuk", kind: "income" },
];

async function main() {
  const apply = process.argv.includes("--apply");
  const { db } = await import("../src/db");
  const { categories } = await import("../src/db/schema");

  const existing = await db.select().from(categories);
  const has = (name: string, kind: string) =>
    existing.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.kind === kind);

  console.log("Existing:", existing.map((c) => `${c.name} (${c.kind})`).join(", ") || "(none)");
  const missing = WANTED.filter((w) => !has(w.name, w.kind));
  console.log(missing.length ? "Missing:" : "Nothing to add.", missing.map((m) => `${m.name} (${m.kind})`).join(", "));

  if (apply && missing.length) {
    await db.insert(categories).values(missing.map((m) => ({ ...m, isSystem: true })));
    console.log(`Inserted ${missing.length}.`);
  } else if (missing.length) {
    console.log("Dry run — pass --apply to insert.");
  }
  process.exit(0);
}

main();
