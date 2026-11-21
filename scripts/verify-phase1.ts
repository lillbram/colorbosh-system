/** Read-only: prints P&L for the spec §0 reference periods. npx tsx scripts/verify-phase1.ts */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { getPnL } = await import("../src/lib/finance");
  for (const [label, start, end] of [
    ["Oct 2026", "2026-10-01", "2026-10-31"],
    ["Nov 1-18 2026", "2026-11-01", "2026-11-18"],
  ] as const) {
    const pnl = await getPnL(start, end);
    console.log(label, { ...pnl, penjualanPerChannel: pnl.penjualanPerChannel.length + " channels" });
  }
  process.exit(0);
}

main();
